use super::host_key::{config, handler, Handler};
use crate::model::Connection;
use russh::{
    client::{self, AuthResult},
    keys::{decode_secret_key, PrivateKeyWithHashAlg},
    ChannelMsg, MethodKind, MethodSet,
};
use std::sync::Arc;
use zeroize::Zeroizing;

// Only a server that still offers passwords can be asked for one.
fn accepts_password(auth: &AuthResult) -> bool {
    matches!(auth, AuthResult::Failure { remaining_methods, .. } if remaining_methods.contains(&MethodKind::Password))
}
/// Connects and authenticates. When the key or the stored password is refused (or missing), `ask`
/// is called with whether a typed password was already refused; `None` means the user gave up.
pub(super) async fn open<Ask, Answer>(
    connection: &Connection,
    report: impl Fn(&str),
    mut ask: Ask,
) -> Result<
    (
        client::Handle<Handler>,
        russh::Channel<client::Msg>,
        Vec<u8>,
    ),
    String,
>
where
    Ask: FnMut(bool) -> Answer,
    Answer: std::future::Future<Output = Option<Zeroizing<String>>>,
{
    let host = &connection.host;
    report("Connessione al server SSH");
    let h = handler(Some(host.fingerprint.clone()));
    let seen = h.seen.clone();
    let mut session=client::connect(config(),(host.address.as_str(),host.port.unwrap_or(22)),h).await.map_err(|e|{
        if seen.lock().ok().and_then(|s|s.clone()).is_some_and(|f|f!=host.fingerprint){"Identità del server cambiata. Connessione bloccata: verifica la nuova impronta fuori dall’app.".into()}else{e.to_string()}
    })?;
    report("Impronta del server verificata");
    report("Autenticazione SSH");
    let mut auth = if connection.auth == "key" {
        let secret = decode_secret_key(
            &connection.private_key,
            if connection.passphrase.is_empty() {
                None
            } else {
                Some(&connection.passphrase)
            },
        )
        .map_err(|e| e.to_string())?;
        let algorithm = session
            .best_supported_rsa_hash()
            .await
            .map_err(|e| e.to_string())?
            .flatten();
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
        session
            .authenticate_password(&connection.username, &connection.password)
            .await
    }
    .map_err(|e| e.to_string())?;
    let mut refused = false;
    while !auth.success() {
        if !accepts_password(&auth) {
            return Err("Autenticazione fallita".into());
        }
        let password = ask(refused)
            .await
            .ok_or("Autenticazione annullata".to_string())?;
        refused = true;
        // Nothing to send: ask again, without bothering the server.
        if password.is_empty() {
            continue;
        }
        auth = session
            .authenticate_password(&connection.username, password.as_str())
            .await
            .map_err(|e| e.to_string())?;
    }
    report("Apertura del terminale remoto");
    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    channel
        .request_pty(true, "xterm-256color", 100, 30, 0, 0, &[])
        .await
        .map_err(|e| e.to_string())?;
    channel
        .request_shell(true)
        .await
        .map_err(|e| e.to_string())?;
    let mut accepted = 0;
    let mut buffered = Vec::new();
    while accepted < 2 {
        match channel.wait().await {
            Some(ChannelMsg::Success) => accepted += 1,
            Some(ChannelMsg::Data { data }) | Some(ChannelMsg::ExtendedData { data, .. }) => {
                if buffered.len() + data.len() > 262144 {
                    return Err("Risposta iniziale del server troppo grande".into());
                }
                buffered.extend_from_slice(&data);
            }
            Some(ChannelMsg::Failure) => {
                return Err("Il server ha rifiutato terminale o shell".into())
            }
            Some(ChannelMsg::Close) | Some(ChannelMsg::Eof) | None => {
                return Err("Il server ha chiuso la connessione prima di aprire la shell".into())
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
            assert!(matches!(open(&host, |_| {}, |_| async { None }).await,Err(error) if error.contains("rifiutato terminale o shell")));
            allow_shell.store(true,Ordering::SeqCst);
            host.password = "incorrect".into();
            assert!(open(&host, |_| {}, |_| async { None }).await.is_err());
            let before = attempts.load(Ordering::SeqCst);
            host.host.fingerprint = "SHA256:wrong".into();
            let result = open(&host, |_| {}, |_| async { None }).await;
            assert!(matches!(result,Err(e) if e.contains("Identità del server cambiata")));
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
            assert!(matches!(result, Err(e) if e == "Autenticazione annullata"));
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
            assert!(matches!(result, Err(e) if e == "Autenticazione fallita"));
            assert!(asked.lock().unwrap().is_empty());
            task.abort();
        })
        .await
        .expect("SSH fixture timed out");
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
