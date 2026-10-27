use super::{
    connection::{open, Note},
    messages::{ConnectionMetadata, Input, Output, StepDetail},
    os_probe::detect_os,
    password::PasswordPrompt,
};
use crate::{
    model::Connection,
    state::{record_connection, AppState},
};
use russh::{ChannelMsg, Disconnect};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{ipc::Channel, Manager};
use tokio::sync::mpsc;

async fn run(
    app: tauri::AppHandle,
    vault_id: String,
    saved: bool,
    host: Connection,
    mut rx: mpsc::UnboundedReceiver<Input>,
    output: &Channel<Output>,
) -> Result<(), String> {
    let _ = output.send(Output::Status("Connessione…".into()));
    let prompt = PasswordPrompt::default();
    let opening = open(
        &host,
        |note| {
            let _ = output.send(match note {
                Note::Stage(stage) => Output::Status(stage.into()),
                Note::Log(line) => Output::Log(line),
                Note::Detail { step, warn, text } => {
                    Output::Detail(StepDetail { step, warn, text })
                }
            });
        },
        |refused| {
            let answer = prompt.ask();
            let _ = output.send(Output::PasswordNeeded(refused));
            async move { answer.await.ok() }
        },
    );
    tokio::pin!(opening);
    // The timeout does not run while the user is typing a password.
    let limit = || tokio::time::Instant::now() + Duration::from_secs(30);
    let timeout = tokio::time::sleep_until(limit());
    tokio::pin!(timeout);
    // Lock/close cancels transport establishment and authentication as well as live sessions.
    let (session, mut channel, buffered) = loop {
        tokio::select! {
            result=&mut opening=>break result?,
            _=&mut timeout,if !prompt.asking()=>return Err("Timeout connessione SSH".into()),
            input=rx.recv()=>match input{
                Some(Input::Password(password))=>{
                    if prompt.answer(password){timeout.as_mut().reset(limit());}
                },
                Some(Input::Close)|None=>return Ok(()),
                Some(_)=>{}
            },
        }
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
                Some(Input::Password(_))=>{}
                Some(Input::Close)|None=>{let _=channel.close().await;let _=output.send(Output::Log("Connessione chiusa dall’utente".into()));break;}
            },
            msg=channel.wait()=>match msg{
                Some(ChannelMsg::Data{data})|Some(ChannelMsg::ExtendedData{data,..})=>{if output.send(Output::Data(data.to_vec())).is_err(){break;}},
                Some(ChannelMsg::Failure)=>return Err("Il server ha rifiutato terminale o shell".into()),
                Some(ChannelMsg::Close)|None=>{let _=output.send(Output::Log("Connessione chiusa dal server".into()));break;},
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
    let port = host.host.port.unwrap_or(22);
    let output = output.clone();
    tauri::async_runtime::spawn_blocking(move || {
        match record_connection(
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
pub(crate) fn register(
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
pub(crate) fn send(state: &AppState, vault_id: &str, id: &str, input: Input) -> Result<(), String> {
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
pub(crate) fn session_scope<'a>(
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
    use std::sync::Arc;
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
