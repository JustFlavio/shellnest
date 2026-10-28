//! Opens one SSH connection: host key check, authentication (key, saved password, asked password), shell.
use super::{
    host_key::{config, handler, Handler},
    TerminalError,
};
use crate::locks::MutexExt;
use crate::model::Connection;
use russh::{
    client::{self, AuthResult},
    keys::{decode_secret_key, PrivateKeyWithHashAlg},
    ChannelMsg, MethodKind, MethodSet,
};
use std::sync::Arc;
use zeroize::Zeroizing;

/// Passwords the user may type for one connection before it is given up.
pub(super) const MAX_PASSWORD_ATTEMPTS: usize = 3;

/// What `open` tells the UI along the way.
pub(super) enum Note {
    Stage(&'static str),
    /// One line of the connection log: plain text, never a password, key or answer.
    Log(String),
    /// How a step ended. `warn` is a partial result (a fallback), not a plain success.
    Detail {
        step: String,
        warn: bool,
        text: String,
    },
}

// Only a server that still offers passwords can be asked for one.
fn accepts_password(auth: &AuthResult) -> bool {
    matches!(auth, AuthResult::Failure { remaining_methods, .. } if remaining_methods.contains(&MethodKind::Password))
}
fn methods_of(auth: &AuthResult) -> Vec<&'static str> {
    match auth {
        AuthResult::Failure {
            remaining_methods, ..
        } => remaining_methods.iter().map(<&str>::from).collect(),
        AuthResult::Success => vec![],
    }
}
// The timeline step of the n-th password question (1-based).
fn password_step(n: usize) -> String {
    if n == 1 {
        "password".into()
    } else {
        format!("password-{n}")
    }
}
/// Connects and authenticates. When the key or the stored password is refused (or missing), `ask`
/// is called with whether a typed password was already refused; `None` means the user gave up.
/// After `MAX_PASSWORD_ATTEMPTS` refused passwords it stops asking.
pub(super) async fn open<Ask, Answer>(
    connection: &Connection,
    report: impl Fn(Note),
    mut ask: Ask,
) -> Result<
    (
        client::Handle<Handler>,
        russh::Channel<client::Msg>,
        Vec<u8>,
    ),
    TerminalError,
>
where
    Ask: FnMut(bool) -> Answer,
    Answer: std::future::Future<Output = Option<Zeroizing<String>>>,
{
    let host = &connection.host;
    let port = host.port.unwrap_or(22);
    let log = |text: String| report(Note::Log(text));
    let detail = |step: &str, warn: bool, text: &str| {
        report(Note::Detail {
            step: step.into(),
            warn,
            text: text.into(),
        })
    };
    report(Note::Stage("Connessione al server SSH"));
    log(format!("Risoluzione di {}:{port}", host.address));
    match tokio::net::lookup_host((host.address.as_str(), port)).await {
        Ok(found) => {
            let list: Vec<String> = found.map(|a| a.ip().to_string()).collect();
            log(format!("Indirizzi trovati: {}", list.join(", ")));
        }
        Err(e) => log(format!("Risoluzione non riuscita: {e}")),
    }
    let h = handler(Some(host.fingerprint.clone()));
    let seen = h.seen.clone();
    let info = h.info.clone();
    let mut session = client::connect(config(), (host.address.as_str(), port), h)
        .await
        .map_err(|e| {
            let found = seen.lock_recovering().clone();
            if found.as_ref().is_some_and(|f| *f != host.fingerprint) {
                log(format!(
                    "Impronta del server cambiata: attesa {}, ricevuta {}",
                    host.fingerprint,
                    found.unwrap_or_default()
                ));
                TerminalError::ServerKeyChanged
            } else {
                log(format!("Connessione non riuscita: {e}"));
                e.into()
            }
        })?;
    log("Connessione stabilita".into());
    let server = info.lock_recovering().clone();
    if let Some(server) = &server {
        log(format!("Server remoto: {}", server.banner));
        log(format!("Algoritmi negoziati: {}", server.algorithms));
    }
    log(format!(
        "Impronta del server nota e coincidente: {}",
        host.fingerprint
    ));
    report(Note::Stage("Impronta del server verificata"));
    report(Note::Stage("Autenticazione SSH"));
    let is_key = connection.auth == "key";
    let mut auth = if is_key {
        let secret = decode_secret_key(
            &connection.private_key,
            if connection.passphrase.is_empty() {
                None
            } else {
                Some(&connection.passphrase)
            },
        )?;
        let algorithm = session.best_supported_rsa_hash().await?.flatten();
        log(format!(
            "Autenticazione con chiave per l’utente {}",
            connection.username
        ));
        session
            .authenticate_publickey(
                &connection.username,
                PrivateKeyWithHashAlg::new(Arc::new(secret), algorithm),
            )
            .await
    } else if connection.password.is_empty() {
        // Nothing stored to try: go straight to asking.
        Ok(AuthResult::Failure {
            remaining_methods: MethodSet::from(&[MethodKind::Password][..]),
            partial_success: false,
        })
    } else {
        log(format!(
            "Autenticazione con password salvata per l’utente {}",
            connection.username
        ));
        session
            .authenticate_password(&connection.username, &connection.password)
            .await
    }?;
    let tried_something = is_key || !connection.password.is_empty();
    if auth.success() {
        let how = if is_key { "chiave" } else { "password" };
        log(format!("Autenticazione con {how} accettata"));
        detail(
            "auth",
            false,
            &if is_key && !connection.key_name.is_empty() {
                format!("Autenticato con la chiave “{}”", connection.key_name)
            } else if is_key {
                "Autenticato con la chiave".into()
            } else {
                "Autenticato con la password".into()
            },
        );
    } else if tried_something {
        let what = if is_key { "chiave" } else { "password salvata" };
        log(format!("Autenticazione con {what} rifiutata dal server"));
        let methods = methods_of(&auth);
        if !methods.is_empty() {
            log(format!(
                "Metodi ancora accettati dal server: {}",
                methods.join(", ")
            ));
        }
        detail(
            "auth",
            true,
            &if is_key {
                "Chiave rifiutata dal server".to_string()
            } else {
                "Password salvata rifiutata".to_string()
            },
        );
    }
    let mut refused = false;
    let (mut asked, mut sent) = (0, 0);
    while !auth.success() {
        if !accepts_password(&auth) {
            let error = TerminalError::AuthRefused(methods_of(&auth));
            log(error.to_string());
            return Err(error);
        }
        asked += 1;
        let password = ask(refused).await.ok_or_else(|| {
            log("Autenticazione annullata dall’utente".into());
            TerminalError::AuthCancelled
        })?;
        refused = true;
        // Nothing to send: ask again, without bothering the server.
        if password.is_empty() {
            continue;
        }
        sent += 1;
        log(format!(
            "Tentativo con password {sent} di {MAX_PASSWORD_ATTEMPTS}"
        ));
        auth = session
            .authenticate_password(&connection.username, password.as_str())
            .await?;
        let step = password_step(asked);
        if auth.success() {
            log("Password accettata".into());
            detail(&step, false, "Password accettata");
        } else {
            log("Password rifiutata dal server".into());
            detail(&step, true, "Password non accettata");
            if sent >= MAX_PASSWORD_ATTEMPTS {
                let error = TerminalError::PasswordsExhausted(MAX_PASSWORD_ATTEMPTS);
                log(error.to_string());
                return Err(error);
            }
        }
    }
    report(Note::Stage("Apertura del terminale remoto"));
    log("Apertura di terminale e shell remota".into());
    let mut channel = session.channel_open_session().await?;
    channel
        .request_pty(true, "xterm-256color", 100, 30, 0, 0, &[])
        .await?;
    channel.request_shell(true).await?;
    let mut accepted = 0;
    let mut buffered = Vec::new();
    while accepted < 2 {
        match channel.wait().await {
            Some(ChannelMsg::Success) => accepted += 1,
            Some(ChannelMsg::Data { data }) | Some(ChannelMsg::ExtendedData { data, .. }) => {
                if buffered.len() + data.len() > 262144 {
                    return Err(TerminalError::InitialOutputTooLarge);
                }
                buffered.extend_from_slice(&data);
            }
            Some(ChannelMsg::Failure) => return Err(TerminalError::ShellRefused),
            Some(ChannelMsg::Close) | Some(ChannelMsg::Eof) | None => {
                return Err(TerminalError::ClosedBeforeShell)
            }
            _ => {}
        }
    }
    Ok((session, channel, buffered))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Host;
    use crate::terminal::{os_probe::detect_os, test_server::*};
    use russh::Disconnect;
    use russh::{
        keys::{Algorithm, HashAlg, PrivateKey},
        server,
    };
    use std::{
        sync::{
            atomic::{AtomicBool, AtomicUsize, Ordering},
            Mutex,
        },
        time::Duration,
    };
    #[tokio::test]
    async fn ssh_password_key_echo_and_changed_identity() {
        tokio::time::timeout(Duration::from_secs(15), async {
            let key = PrivateKey::random(&mut rand10::rng(), Algorithm::Ed25519).unwrap();
            let server_key = PrivateKey::random(&mut rand10::rng(), Algorithm::Ed25519).unwrap();
            let fingerprint = server_key
                .public_key()
                .fingerprint(HashAlg::Sha256)
                .to_string();
            let attempts = Arc::new(AtomicUsize::new(0));
            let allow_shell=Arc::new(AtomicBool::new(true));
            let echo = Echo {
                key: key.public_key().clone(),
                attempts: attempts.clone(),
                allow_shell:allow_shell.clone(),
                offered: MethodSet::from(&[MethodKind::Password, MethodKind::PublicKey][..]),
            };
            let config = Arc::new(server::Config {
                keys: vec![server_key],
                auth_rejection_time: Duration::ZERO,
                ..Default::default()
            });
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            let task = tokio::spawn(async move {
                while let Ok((socket, _)) = listener.accept().await {
                    let config = config.clone();
                    let echo = echo.clone();
                    tokio::spawn(async move {
                        if let Ok(session) = server::run_stream(config, socket, echo).await {
                            let _ = session.await;
                        }
                    });
                }
            });
            let mut host = Connection {
                host: Host {
                    id: "test".into(),
                    name: "test".into(),
                    address: "127.0.0.1".into(),
                    port: Some(port),
                    group_id: String::new(),
                    identity_id: "test-identity".into(),
                    credentials: None,
                    fingerprint,
                    os: None,
                    last_connected_at: None,
                },
                username: "test".into(),
                auth: "password".into(),
                password: "test-only-password".into(),
                private_key: key.to_openssh(Default::default()).unwrap().to_string(),
                passphrase: String::new(),
                key_name: "chiave di prova".into(),
            };
            for auth in ["password", "key"] {
                host.auth = auth.into();
                let (session, mut channel, buffered) = open(&host, |_| {}, |_| async { None }).await.unwrap();
                assert_eq!(buffered,b"fixture login banner\r\n");
                assert_eq!(detect_os(&session).await.as_deref(), Some("ubuntu"));
                channel.window_change(120, 40, 0, 0).await.unwrap();
                channel.data(&b"hello SSH\r\n"[..]).await.unwrap();
                loop {
                    if let Some(ChannelMsg::Data { data }) = channel.wait().await {
                        assert_eq!(&data[..], b"hello SSH\r\n");
                        break;
                    }
                }
                session
                    .disconnect(Disconnect::ByApplication, "", "en")
                    .await
                    .unwrap();
            }
            host.auth = "password".into();
            allow_shell.store(false,Ordering::SeqCst);
            assert!(matches!(open(&host, |_| {}, |_| async { None }).await,Err(error) if error.to_string().contains("rifiutato terminale o shell")));
            allow_shell.store(true,Ordering::SeqCst);
            host.password = "incorrect".into();
            assert!(open(&host, |_| {}, |_| async { None }).await.is_err());
            let before = attempts.load(Ordering::SeqCst);
            host.host.fingerprint = "SHA256:wrong".into();
            let result = open(&host, |_| {}, |_| async { None }).await;
            assert!(matches!(result,Err(e) if e.to_string().contains("Identità del server cambiata")));
            assert_eq!(
                attempts.load(Ordering::SeqCst),
                before,
                "Changed server key must be rejected before credentials"
            );
            task.abort();
        })
        .await
        .expect("SSH fixture timed out");
    }
    fn answers(
        script: Vec<Option<&'static str>>,
        asked: Arc<Mutex<Vec<bool>>>,
    ) -> impl FnMut(bool) -> std::future::Ready<Option<Zeroizing<String>>> {
        let mut script = script.into_iter();
        move |refused| {
            asked.lock().unwrap().push(refused);
            std::future::ready(
                script
                    .next()
                    .flatten()
                    .map(|p| Zeroizing::new(p.to_string())),
            )
        }
    }
    #[tokio::test]
    async fn refused_key_asks_for_a_password_and_allows_another_attempt() {
        tokio::time::timeout(Duration::from_secs(15), async {
            let (connection, task) = fixture(true).await;
            let asked = Arc::new(Mutex::new(Vec::new()));
            // Wrong password first, then the right one.
            let ask = answers(
                vec![Some("wrong"), Some("test-only-password")],
                asked.clone(),
            );
            let (session, _, _) = open(&connection, |_| {}, ask).await.unwrap();
            assert_eq!(*asked.lock().unwrap(), vec![false, true]);
            let _ = session
                .disconnect(Disconnect::ByApplication, "", "en")
                .await;

            // Cancelling ends the attempt without a session.
            let asked = Arc::new(Mutex::new(Vec::new()));
            let result = open(&connection, |_| {}, answers(vec![None], asked.clone())).await;
            assert!(matches!(result, Err(e) if e.to_string() == "Autenticazione annullata"));
            assert_eq!(*asked.lock().unwrap(), vec![false]);

            // An empty answer asks again without a server round trip counting as a refusal by the server.
            let asked = Arc::new(Mutex::new(Vec::new()));
            let ask = answers(vec![Some(""), Some("test-only-password")], asked.clone());
            assert!(open(&connection, |_| {}, ask).await.is_ok());
            assert_eq!(*asked.lock().unwrap(), vec![false, true]);

            // A stored password that is refused also falls back to asking.
            let mut stored = connection.clone();
            stored.auth = "password".into();
            stored.password = "stale".into();
            let asked = Arc::new(Mutex::new(Vec::new()));
            let ask = answers(vec![Some("test-only-password")], asked.clone());
            assert!(open(&stored, |_| {}, ask).await.is_ok());
            assert_eq!(*asked.lock().unwrap(), vec![false]);
            task.abort();
        })
        .await
        .expect("SSH fixture timed out");
    }
    #[tokio::test]
    async fn no_prompt_when_the_server_does_not_take_passwords() {
        tokio::time::timeout(Duration::from_secs(15), async {
            let (connection, task) = fixture(false).await;
            let asked = Arc::new(Mutex::new(Vec::new()));
            let result = open(&connection, |_| {}, answers(vec![Some("x")], asked.clone())).await;
            assert!(matches!(result, Err(e) if e.to_string() == "Autenticazione fallita. Metodi accettati dal server: publickey."));
            assert!(asked.lock().unwrap().is_empty());
            task.abort();
        })
        .await
        .expect("SSH fixture timed out");
    }
    // Notes as one line each: "log: …" or "step <id> <ok|warn>: …".
    fn collect(notes: &Arc<Mutex<Vec<String>>>) -> impl Fn(Note) {
        let notes = notes.clone();
        move |note| {
            notes.lock().unwrap().push(match note {
                Note::Stage(s) => format!("stage: {s}"),
                Note::Log(l) => format!("log: {l}"),
                Note::Detail { step, warn, text } => {
                    format!("step {step} {}: {text}", if warn { "warn" } else { "ok" })
                }
            })
        }
    }
    #[tokio::test]
    async fn gives_up_after_three_refused_passwords_and_logs_without_secrets() {
        tokio::time::timeout(Duration::from_secs(15), async {
            let (connection, task) = fixture(true).await;
            let notes = Arc::new(Mutex::new(Vec::new()));
            let asked = Arc::new(Mutex::new(Vec::new()));
            let ask = answers(
                vec![
                    Some("hunter2-a"),
                    Some("hunter2-b"),
                    Some("hunter2-c"),
                    Some("test-only-password"),
                ],
                asked.clone(),
            );
            let result = open(&connection, collect(&notes), ask).await;
            assert!(matches!(result, Err(e) if e.to_string() == "Password non accettata dopo 3 tentativi."));
            assert_eq!(*asked.lock().unwrap(), vec![false, true, true]);
            let notes = notes.lock().unwrap().join("\n");
            assert!(notes.contains("log: Server remoto: SSH-2.0-"), "{notes}");
            assert!(
                notes.contains("log: Algoritmi negoziati: scambio chiavi"),
                "{notes}"
            );
            assert!(
                notes.contains("log: Metodi ancora accettati dal server: password, publickey"),
                "{notes}"
            );
            assert!(notes.contains("step auth warn: Chiave rifiutata dal server"));
            assert!(notes.contains("step password warn: Password non accettata"));
            assert!(notes.contains("step password-3 warn: Password non accettata"));
            assert!(!notes.contains("password-4"));
            assert!(!notes.contains("hunter2") && !notes.contains("test-only-password"));
            task.abort();
        })
        .await
        .expect("SSH fixture timed out");
    }
    #[tokio::test]
    async fn the_log_tells_a_fallback_from_a_plain_success() {
        tokio::time::timeout(Duration::from_secs(15), async {
            let (connection, task) = fixture(true).await;
            let notes = Arc::new(Mutex::new(Vec::new()));
            let ask = answers(vec![Some("test-only-password")], Arc::default());
            let (session, _, _) = open(&connection, collect(&notes), ask).await.unwrap();
            let _ = session
                .disconnect(Disconnect::ByApplication, "", "en")
                .await;
            let notes = notes.lock().unwrap().join("\n");
            assert!(
                notes.contains("step auth warn: Chiave rifiutata dal server"),
                "{notes}"
            );
            assert!(
                notes.contains("step password ok: Password accettata"),
                "{notes}"
            );
            assert!(
                notes.contains("log: Impronta del server nota e coincidente: SHA256:"),
                "{notes}"
            );
            let mut known = connection.clone();
            known.auth = "password".into();
            known.password = "test-only-password".into();
            let plain = Arc::new(Mutex::new(Vec::new()));
            let (session, _, _) = open(&known, collect(&plain), |_| async { None })
                .await
                .unwrap();
            let _ = session
                .disconnect(Disconnect::ByApplication, "", "en")
                .await;
            assert!(plain
                .lock()
                .unwrap()
                .contains(&"step auth ok: Autenticato con la password".to_string()));
            task.abort();
        })
        .await
        .expect("SSH fixture timed out");
    }
    #[test]
    fn password_steps_are_numbered_from_the_second_question() {
        assert_eq!(password_step(1), "password");
        assert_eq!(password_step(3), "password-3");
    }
    #[test]
    fn only_a_refusal_that_offers_passwords_prompts() {
        let refused = |methods: &[MethodKind]| AuthResult::Failure {
            remaining_methods: MethodSet::from(methods),
            partial_success: false,
        };
        assert!(accepts_password(&refused(&[
            MethodKind::PublicKey,
            MethodKind::Password
        ])));
        assert!(!accepts_password(&refused(&[MethodKind::PublicKey])));
        assert!(!accepts_password(&AuthResult::Success));
    }
}
