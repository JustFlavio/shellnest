use crate::{commit, model::Connection, AppState};
use russh::{
    client,
    keys::{decode_secret_key, HashAlg, PrivateKeyWithHashAlg, PublicKeyOrCertificate},
    ChannelMsg, Disconnect,
};
use serde::Serialize;
use std::{
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, Manager, State};
use tokio::sync::mpsc;

pub enum Input {
    Data(Vec<u8>),
    Resize(u32, u32),
    Close,
}
#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "lowercase")]
pub enum Output {
    Data(Vec<u8>),
    Status(String),
    Error(String),
    Metadata(ConnectionMetadata),
    Closed,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionMetadata {
    pub os: Option<String>,
    pub last_connected_at: u64,
}
struct Handler {
    expected: Option<String>,
    seen: Arc<Mutex<Option<String>>>,
}
impl client::Handler for Handler {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        let fingerprint = key.public_key().fingerprint(HashAlg::Sha256).to_string();
        if let Ok(mut seen) = self.seen.lock() {
            *seen = Some(fingerprint.clone());
        }
        Ok(self
            .expected
            .as_ref()
            .is_none_or(|expected| expected == &fingerprint))
    }
}
fn handler(expected: Option<String>) -> Handler {
    Handler {
        expected,
        seen: Arc::new(Mutex::new(None)),
    }
}
fn config() -> Arc<client::Config> {
    Arc::new(client::Config {
        keepalive_interval: Some(Duration::from_secs(30)),
        keepalive_max: 3,
        ..Default::default()
    })
}
#[tauri::command]
pub async fn probe_host(
    app: tauri::AppHandle,
    vault_id: String,
    id: String,
) -> Result<String, String> {
    let host = {
        let state = app.state::<AppState>();
        let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
        state.ensure_vault(&vault_id)?;
        guard
            .as_ref()
            .ok_or("Vault bloccato")?
            .data
            .hosts
            .iter()
            .find(|h| h.id == id)
            .cloned()
            .ok_or("Host non trovato")?
    };
    probe(&host.address, host.port).await
}
fn validate_target(address: &str, port: u16) -> Result<(), String> {
    crate::model::validate_endpoint(address, port)
}
#[tauri::command]
pub async fn probe_target(
    app: tauri::AppHandle,
    vault_id: String,
    address: String,
    port: u16,
) -> Result<String, String> {
    {
        let state = app.state::<AppState>();
        let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
        state.ensure_vault(&vault_id)?;
        guard.as_ref().ok_or("Vault bloccato")?;
    }
    validate_target(&address, port)?;
    probe(&address, port).await
}
async fn probe(address: &str, port: u16) -> Result<String, String> {
    let h = handler(None);
    let seen = h.seen.clone();
    // Probe establishes transport only. No user authentication or credentials are sent.
    let session = tokio::time::timeout(
        Duration::from_secs(15),
        client::connect(config(), (address, port), h),
    )
    .await
    .map_err(|_| "Timeout durante la verifica del server")?
    .map_err(|e| e.to_string())?;
    let _ = session
        .disconnect(Disconnect::ByApplication, "", "en")
        .await;
    let result = seen
        .lock()
        .map_err(|_| "Impronta non disponibile")?
        .clone()
        .ok_or("Impronta non disponibile".to_string());
    result
}
#[tauri::command]
pub fn trust_host(
    state: State<AppState>,
    vault_id: String,
    id: String,
    expected: String,
    address: String,
    port: u16,
) -> Result<(), String> {
    if !expected.starts_with("SHA256:") || expected.len() != 50 {
        return Err("Impronta non valida".into());
    }
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_mut().ok_or("Vault bloccato")?;
    let mut data = v.data.clone();
    let host = data
        .hosts
        .iter_mut()
        .find(|h| h.id == id)
        .ok_or("Host non trovato")?;
    if !host.fingerprint.is_empty() {
        return Err("Questo host ha già un’impronta salvata".into());
    }
    if host.address != address || host.port != port {
        return Err("La destinazione è cambiata. Ripeti la verifica dell’impronta.".into());
    }
    host.fingerprint = expected;
    commit(&state, v, data)
}
async fn open(
    connection: &Connection,
    report: impl Fn(&str),
) -> Result<
    (
        client::Handle<Handler>,
        russh::Channel<client::Msg>,
        Vec<u8>,
    ),
    String,
> {
    let host = &connection.host;
    report("Connessione al server SSH");
    let h = handler(Some(host.fingerprint.clone()));
    let seen = h.seen.clone();
    let mut session=client::connect(config(),(host.address.as_str(),host.port),h).await.map_err(|e|{
        if seen.lock().ok().and_then(|s|s.clone()).is_some_and(|f|f!=host.fingerprint){"Identità del server cambiata. Connessione bloccata: verifica la nuova impronta fuori dall’app.".into()}else{e.to_string()}
    })?;
    report("Impronta del server verificata");
    report("Autenticazione SSH");
    let auth = if connection.auth == "key" {
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
    } else {
        session
            .authenticate_password(&connection.username, &connection.password)
            .await
    }
    .map_err(|e| e.to_string())?;
    if !auth.success() {
        return Err("Autenticazione fallita".into());
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
const OS_PROBE: &str = "cat /etc/os-release 2>/dev/null || uname -s";
async fn detect_os(session: &client::Handle<Handler>) -> Option<String> {
    let mut channel =
        tokio::time::timeout(Duration::from_millis(750), session.channel_open_session())
            .await
            .ok()?
            .ok()?;
    let result = tokio::time::timeout(Duration::from_secs(2), async {
        channel.exec(true, OS_PROBE).await.ok()?;
        let mut bytes = Vec::new();
        while let Some(message) = channel.wait().await {
            match message {
                ChannelMsg::Data { data } => {
                    if bytes.len() + data.len() > 8192 {
                        return None;
                    }
                    bytes.extend_from_slice(&data);
                }
                ChannelMsg::Failure => return None,
                ChannelMsg::Eof | ChannelMsg::Close => break,
                _ => {}
            }
        }
        parse_os(&bytes)
    })
    .await
    .ok()
    .flatten();
    let _ = tokio::time::timeout(Duration::from_millis(250), channel.close()).await;
    result
}
fn parse_os(bytes: &[u8]) -> Option<String> {
    if bytes.len() > 8192 {
        return None;
    }
    let text = std::str::from_utf8(bytes).ok()?;
    if let Some(value) = text
        .lines()
        .find_map(|line| line.trim().strip_prefix("ID="))
    {
        let id = value.trim().trim_matches(['\"', '\'']);
        if !id.is_empty()
            && id.len() <= 32
            && id
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, b'-' | b'_'))
        {
            return Some(id.into());
        }
        return None;
    }
    match text.trim() {
        "Linux" => Some("linux".into()),
        "Darwin" => Some("macos".into()),
        "FreeBSD" => Some("freebsd".into()),
        "OpenBSD" => Some("openbsd".into()),
        _ => None,
    }
}
async fn run(
    app: tauri::AppHandle,
    vault_id: String,
    saved: bool,
    host: Connection,
    mut rx: mpsc::UnboundedReceiver<Input>,
    output: &Channel<Output>,
) -> Result<(), String> {
    let _ = output.send(Output::Status("Connessione…".into()));
    // Lock/close cancels transport establishment and authentication as well as live sessions.
    let (session, mut channel, buffered) = tokio::select! {
        result=tokio::time::timeout(Duration::from_secs(30),open(&host, |stage| { let _ = output.send(Output::Status(stage.into())); }))=>result.map_err(|_|"Timeout connessione SSH")??,
        _=rx.recv()=>return Ok(()),
    };
    let _ = output.send(Output::Status("Connesso".into()));
    if !buffered.is_empty() {
        let _ = output.send(Output::Data(buffered));
    }
    let connected_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    publish_metadata(&app, &vault_id, saved, &host, output, None, connected_at);
    let metadata = detect_os(&session);
    tokio::pin!(metadata);
    let mut metadata_done = false;
    loop {
        tokio::select! {
            os=&mut metadata,if !metadata_done=>{
                metadata_done=true;
                if os.is_some(){publish_metadata(&app,&vault_id,saved,&host,output,os,connected_at);}
            },
            input=rx.recv()=>match input{
                Some(Input::Data(bytes))=>channel.data(&bytes[..]).await.map_err(|e|e.to_string())?,
                Some(Input::Resize(cols,rows))=>channel.window_change(cols,rows,0,0).await.map_err(|e|e.to_string())?,
                Some(Input::Close)|None=>{let _=channel.close().await;break;}
            },
            msg=channel.wait()=>match msg{
                Some(ChannelMsg::Data{data})|Some(ChannelMsg::ExtendedData{data,..})=>{if output.send(Output::Data(data.to_vec())).is_err(){break;}},
                Some(ChannelMsg::Failure)=>return Err("Il server ha rifiutato terminale o shell".into()),
                Some(ChannelMsg::Close)|None=>break,
                _=>{}
            }
        }
    }
    let _ = session
        .disconnect(Disconnect::ByApplication, "", "en")
        .await;
    Ok(())
}
fn publish_metadata(
    app: &tauri::AppHandle,
    vault_id: &str,
    saved: bool,
    host: &Connection,
    output: &Channel<Output>,
    os: Option<String>,
    now: u64,
) {
    if !saved {
        let _ = output.send(Output::Metadata(ConnectionMetadata {
            os,
            last_connected_at: now,
        }));
        return;
    }
    let app = app.clone();
    let vault_id = vault_id.to_owned();
    let id = host.host.id.clone();
    let address = host.host.address.clone();
    let port = host.host.port;
    let output = output.clone();
    tauri::async_runtime::spawn_blocking(move || {
        match crate::record_connection(
            &app.state::<AppState>(),
            &vault_id,
            &id,
            &address,
            port,
            os.clone(),
            now,
        ) {
            Ok(()) => {
                let _ = output.send(Output::Metadata(ConnectionMetadata {
                    os,
                    last_connected_at: now,
                }));
            }
            Err(error) => {
                let _ = output.send(Output::Error(format!(
                    "Connessione attiva, ma aggiornamento metadati non riuscito: {error}"
                )));
            }
        }
    });
}
#[tauri::command]
pub fn connect(
    app: tauri::AppHandle,
    state: State<AppState>,
    vault_id: String,
    id: String,
    session_id: String,
    output: Channel<Output>,
) -> Result<(), String> {
    let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    let host = guard.as_ref().ok_or("Vault bloccato")?.data.resolve(&id)?;
    if host.host.fingerprint.is_empty() {
        return Err("Verifica prima l’impronta del server".into());
    }
    register(app, &state, vault_id, session_id, host, true, output)
}
#[tauri::command]
pub fn connect_quick(
    app: tauri::AppHandle,
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    address: String,
    port: u16,
    identity_id: String,
    username: Option<String>,
    expected_fingerprint: String,
    output: Channel<Output>,
) -> Result<(), String> {
    validate_target(&address, port)?;
    let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    let connection = guard
        .as_ref()
        .ok_or("Vault bloccato")?
        .data
        .resolve_target(
            &address,
            port,
            &identity_id,
            username.as_deref(),
            &expected_fingerprint,
        )?;
    register(app, &state, vault_id, session_id, connection, false, output)
}
fn register(
    app: tauri::AppHandle,
    state: &AppState,
    vault_id: String,
    session_id: String,
    host: Connection,
    saved: bool,
    output: Channel<Output>,
) -> Result<(), String> {
    if session_id.is_empty() || session_id.len() > 80 {
        return Err("Identificativo sessione non valido".into());
    }
    let (tx, rx) = mpsc::unbounded_channel();
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "Sessioni non disponibili")?;
    if sessions.contains_key(&session_id) {
        return Err("Sessione già aperta".into());
    }
    sessions.insert(session_id.clone(), tx.clone());
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run(app.clone(), vault_id, saved, host, rx, &output).await {
            let _ = output.send(Output::Error(e));
        }
        let _ = output.send(Output::Closed);
        if let Ok(mut sessions) = app.state::<AppState>().sessions.lock() {
            if sessions
                .get(&session_id)
                .is_some_and(|current| current.same_channel(&tx))
            {
                sessions.remove(&session_id);
            }
        }
    });
    Ok(())
}
#[tauri::command]
pub fn terminal_input(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    data: String,
) -> Result<(), String> {
    if data.len() > 65536 {
        return Err("Invia al massimo 64 KiB per messaggio al terminale".into());
    }
    send(
        &state,
        &vault_id,
        &session_id,
        Input::Data(data.into_bytes()),
    )
}
#[tauri::command]
pub fn terminal_resize(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    send(
        &state,
        &vault_id,
        &session_id,
        Input::Resize(cols.clamp(1, 1000), rows.clamp(1, 1000)),
    )
}
#[tauri::command]
pub fn disconnect(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
) -> Result<(), String> {
    let _scope = session_scope(&state, &vault_id)?;
    if let Some(tx) = state
        .sessions
        .lock()
        .map_err(|_| "Sessioni non disponibili")?
        .remove(&session_id)
    {
        let _ = tx.send(Input::Close);
    }
    Ok(())
}
fn send(state: &AppState, vault_id: &str, id: &str, input: Input) -> Result<(), String> {
    let _scope = session_scope(state, vault_id)?;
    state
        .sessions
        .lock()
        .map_err(|_| "Sessioni non disponibili")?
        .get(id)
        .ok_or("Sessione chiusa")?
        .send(input)
        .map_err(|_| "Sessione chiusa".into())
}
fn session_scope<'a>(
    state: &'a AppState,
    vault_id: &str,
) -> Result<std::sync::MutexGuard<'a, crate::vault::VaultCatalog>, String> {
    // A switch drains sessions while holding catalog; terminal IO must not wait on the network-held vault lock.
    let catalog = state
        .catalog
        .lock()
        .map_err(|_| "Registro vault non disponibile")?;
    if catalog.selected != vault_id {
        return Err("Il vault attivo è cambiato. Ripeti l’operazione nel vault corretto.".into());
    }
    Ok(catalog)
}

#[cfg(test)]
mod tests {
    use super::*;
    use russh::{
        keys::{Algorithm, PrivateKey, PublicKey},
        server, ChannelId,
    };
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    #[derive(Clone)]
    struct Echo {
        key: PublicKey,
        attempts: Arc<AtomicUsize>,
        allow_shell: Arc<AtomicBool>,
    }
    impl server::Handler for Echo {
        type Error = russh::Error;
        async fn auth_password(
            &mut self,
            user: &str,
            password: &str,
        ) -> Result<server::Auth, Self::Error> {
            self.attempts.fetch_add(1, Ordering::SeqCst);
            Ok(if user == "test" && password == "test-only-password" {
                server::Auth::Accept
            } else {
                server::Auth::reject()
            })
        }
        async fn auth_publickey(
            &mut self,
            user: &str,
            key: &PublicKey,
        ) -> Result<server::Auth, Self::Error> {
            self.attempts.fetch_add(1, Ordering::SeqCst);
            Ok(if user == "test" && key == &self.key {
                server::Auth::Accept
            } else {
                server::Auth::reject()
            })
        }
        async fn channel_open_session(
            &mut self,
            _: russh::Channel<server::Msg>,
            reply: server::ChannelOpenHandle,
            _: &mut server::Session,
        ) -> Result<(), Self::Error> {
            reply.accept().await;
            Ok(())
        }
        async fn pty_request(
            &mut self,
            id: ChannelId,
            _: &str,
            _: u32,
            _: u32,
            _: u32,
            _: u32,
            _: &[(russh::Pty, u32)],
            session: &mut server::Session,
        ) -> Result<(), Self::Error> {
            session.channel_success(id)?;
            Ok(())
        }
        async fn shell_request(
            &mut self,
            id: ChannelId,
            session: &mut server::Session,
        ) -> Result<(), Self::Error> {
            if !self.allow_shell.load(Ordering::SeqCst) {
                session.channel_failure(id)?;
                return Ok(());
            }
            session.data(id, b"fixture login banner\r\n".to_vec())?;
            session.channel_success(id)?;
            Ok(())
        }
        async fn data(
            &mut self,
            id: ChannelId,
            bytes: &[u8],
            session: &mut server::Session,
        ) -> Result<(), Self::Error> {
            session.data(id, bytes.to_vec())?;
            Ok(())
        }
        async fn exec_request(
            &mut self,
            id: ChannelId,
            command: &[u8],
            session: &mut server::Session,
        ) -> Result<(), Self::Error> {
            assert_eq!(command, OS_PROBE.as_bytes());
            session.channel_success(id)?;
            session.data(id, b"NAME=Ubuntu\nID=ubuntu\n".to_vec())?;
            session.eof(id)?;
            session.close(id)?;
            Ok(())
        }
    }
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
                host: crate::model::Host {
                    id: "test".into(),
                    name: "test".into(),
                    address: "127.0.0.1".into(),
                    port,
                    group: String::new(),
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
                let (session, mut channel, buffered) = open(&host, |_| {}).await.unwrap();
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
            assert!(matches!(open(&host, |_| {}).await,Err(error) if error.contains("rifiutato terminale o shell")));
            allow_shell.store(true,Ordering::SeqCst);
            host.password = "incorrect".into();
            assert!(open(&host, |_| {}).await.is_err());
            let before = attempts.load(Ordering::SeqCst);
            host.host.fingerprint = "SHA256:wrong".into();
            let result = open(&host, |_| {}).await;
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
    #[test]
    fn os_metadata_is_bounded_and_never_includes_arbitrary_remote_text() {
        assert_eq!(
            parse_os(b"NAME=Ubuntu\nID=ubuntu\n").as_deref(),
            Some("ubuntu")
        );
        assert_eq!(parse_os(b"ID=\"debian\"\n").as_deref(), Some("debian"));
        assert_eq!(parse_os(b"Darwin\n").as_deref(), Some("macos"));
        assert!(parse_os(b"ID=ubuntu;rm -rf /\n").is_none());
        assert!(parse_os(&vec![b'x'; 8193]).is_none());
        assert!(parse_os(&[255]).is_none());
        assert!(validate_target("user@host", 22).is_err());
        assert!(validate_target("host\nother", 22).is_err());
        assert!(validate_target("::1", 22).is_ok());
        assert!(validate_target("host", 0).is_err());
    }
    #[test]
    fn terminal_io_is_not_blocked_by_sync_and_rejects_stale_vault_scope() {
        let state = Arc::new(
            AppState::new(std::env::temp_dir().join(format!(
                "unused-terminal-scope-{}.json",
                rand::random::<u64>()
            )))
            .unwrap(),
        );
        let (sender, mut input) = mpsc::unbounded_channel();
        state.sessions.lock().unwrap().insert("test".into(), sender);
        let sync_guard = state.vault.lock().unwrap();
        let worker_state = state.clone();
        let (done, completed) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            let _ = done.send(send(
                &worker_state,
                "personal",
                "test",
                Input::Resize(90, 30),
            ));
        });
        let result = completed.recv_timeout(Duration::from_secs(1));
        drop(sync_guard);
        worker.join().unwrap();
        assert!(result.expect("Terminal IO waited for a slow sync").is_ok());
        assert!(matches!(input.try_recv(), Ok(Input::Resize(90, 30))));
        state.catalog.lock().unwrap().selected = "other".into();
        assert!(send(
            &state,
            "personal",
            "test",
            Input::Data(b"must not arrive".to_vec())
        )
        .is_err());
        assert!(matches!(
            input.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        ));
    }
}
