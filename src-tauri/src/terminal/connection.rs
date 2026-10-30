//! Opens a PTY and shell on an authenticated SSH transport.
use super::TerminalError;
use crate::message::msg;
pub(super) use crate::ssh::Note;
use crate::{model::Connection, ssh::host_key::Handler};
use russh::{ChannelMsg, client};
use zeroize::Zeroizing;

pub(super) async fn open<Ask, Answer>(
    connection: &Connection,
    report: impl Fn(Note),
    ask: Ask,
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
    let session = crate::ssh::authenticate(connection, &report, ask).await?;
    report(Note::Stage("session"));
    report(Note::Log(msg!("log.network.opening")));
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
                return Err(TerminalError::ClosedBeforeShell);
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
    use russh::{Disconnect, MethodKind, MethodSet};
    use russh::{
        keys::{Algorithm, HashAlg, PrivateKey},
        server,
    };
    use std::{
        sync::{
            Arc, Mutex,
            atomic::{AtomicBool, AtomicUsize, Ordering},
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
            let transport = crate::ssh::authenticate(&host, |_| {}, |_| async { None }).await.unwrap();
            transport.disconnect(Disconnect::ByApplication, "", "en").await.unwrap();
            assert!(matches!(open(&host, |_| {}, |_| async { None }).await,Err(error) if error.to_string().contains("refused the terminal or shell")));
            allow_shell.store(true,Ordering::SeqCst);
            host.password = "incorrect".into();
            assert!(open(&host, |_| {}, |_| async { None }).await.is_err());
            let before = attempts.load(Ordering::SeqCst);
            host.host.fingerprint = "SHA256:wrong".into();
            let result = open(&host, |_| {}, |_| async { None }).await;
            assert!(matches!(result,Err(e) if e.to_string().contains("server identity has changed")));
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
            assert!(matches!(result, Err(e) if e.to_string() == "Authentication cancelled"));
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
            assert!(matches!(result, Err(e) if e.to_string() == "Authentication failed. Methods accepted by the server: publickey."));
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
            assert!(matches!(result, Err(e) if e.to_string() == "Password not accepted after 3 attempts."));
            assert_eq!(*asked.lock().unwrap(), vec![false, true, true]);
            let notes = notes.lock().unwrap().join("\n");
            assert!(notes.contains(r#"log: {"code":"log.network.server","params":{"banner":"SSH-2.0-"#), "{notes}");
            assert!(
                notes.contains(r#""code":"log.tech.algorithms""#),
                "{notes}"
            );
            assert!(
                notes.contains(r#""code":"log.auth.methodsLeft","params":{"methods":"password, publickey"}"#),
                "{notes}"
            );
            assert!(notes.contains(r#"step auth warn: {"code":"step.keyRefused"}"#));
            assert!(notes.contains(r#"step password warn: {"code":"step.passwordRefused"}"#));
            assert!(notes.contains(r#"step password-3 warn: {"code":"step.passwordRefused"}"#));
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
                notes.contains(r#"step auth warn: {"code":"step.keyRefused"}"#),
                "{notes}"
            );
            assert!(
                notes.contains(r#"step password ok: {"code":"step.passwordAccepted"}"#),
                "{notes}"
            );
            assert!(
                notes
                    .contains(r#""code":"log.fingerprint.known","params":{"fingerprint":"SHA256:"#),
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
            assert!(
                plain
                    .lock()
                    .unwrap()
                    .contains(&r#"step auth ok: {"code":"step.authPassword"}"#.to_string())
            );
            task.abort();
        })
        .await
        .expect("SSH fixture timed out");
    }
}
