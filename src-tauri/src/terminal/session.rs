use super::{
    connection::{open, Note},
    messages::{ConnectionMetadata, Input, Output, StepDetail},
    os_probe::detect_os,
    password::PasswordPrompt,
    TerminalError,
};
use crate::{
    error::Error,
    model::Connection,
    state::{record_connection, AppState},
};
use russh::{ChannelMsg, Disconnect};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{ipc::Channel, Manager};
use tokio::sync::mpsc;

/// Time allowed to connect and authenticate, not counting the time spent on a password question.
const OPEN_TIMEOUT: Duration = Duration::from_secs(30);

/// Drives `opening` to its end. Lock/close cancels transport establishment and authentication as well
/// as live sessions, so `None` is a close. The timeout does not run while the user is typing a password.
async fn until_open<T>(
    opening: impl std::future::Future<Output = Result<T, TerminalError>>,
    prompt: &PasswordPrompt,
    rx: &mut mpsc::UnboundedReceiver<Input>,
    limit: Duration,
) -> Result<Option<T>, TerminalError> {
    tokio::pin!(opening);
    let mut deadline = tokio::time::Instant::now() + limit;
    loop {
        // A branch precondition is only looked at when the select starts, so `prompt.opened()` ends it
        // when a question opens: the timer is held while asking, and starts over once it is answered.
        tokio::select! {
            result=&mut opening=>return result.map(Some),
            _=tokio::time::sleep_until(deadline),if !prompt.asking()=>return Err(TerminalError::ConnectTimeout),
            _=prompt.opened()=>{},
            input=rx.recv()=>match input{
                Some(Input::Password(password))=>{
                    if prompt.answer(password){deadline=tokio::time::Instant::now()+limit;}
                },
                Some(Input::Close)|None=>return Ok(None),
                Some(_)=>{}
            },
        }
    }
}

async fn run(
    app: tauri::AppHandle,
    vault_id: String,
    saved: bool,
    host: Connection,
    mut rx: mpsc::UnboundedReceiver<Input>,
    output: &Channel<Output>,
) -> Result<(), TerminalError> {
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
    let Some((session, mut channel, buffered)) =
        until_open(opening, &prompt, &mut rx, OPEN_TIMEOUT).await?
    else {
        return Ok(());
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
                Some(Input::Data(bytes))=>channel.data(&bytes[..]).await?,
                Some(Input::Resize(cols,rows))=>channel.window_change(cols,rows,0,0).await?,
                Some(Input::Password(_))=>{}
                Some(Input::Close)|None=>{let _=channel.close().await;let _=output.send(Output::Log("Connessione chiusa dall’utente".into()));break;}
            },
            msg=channel.wait()=>match msg{
                Some(ChannelMsg::Data{data})|Some(ChannelMsg::ExtendedData{data,..})=>{if output.send(Output::Data(data.to_vec())).is_err(){break;}},
                Some(ChannelMsg::Failure)=>return Err(TerminalError::ShellRefused),
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
) -> Result<(), TerminalError> {
    if session_id.is_empty() || session_id.len() > 80 {
        return Err(TerminalError::SessionIdInvalid);
    }
    let (tx, rx) = mpsc::unbounded_channel();
    let mut sessions = state.sessions();
    if sessions.contains_key(&session_id) {
        return Err(TerminalError::SessionOpen);
    }
    sessions.insert(session_id.clone(), tx.clone());
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run(app.clone(), vault_id, saved, host, rx, &output).await {
            let _ = output.send(Output::Error(e.to_string()));
        }
        let _ = output.send(Output::Closed);
        let state = app.state::<AppState>();
        let mut sessions = state.sessions();
        if sessions
            .get(&session_id)
            .is_some_and(|current| current.same_channel(&tx))
        {
            sessions.remove(&session_id);
        }
    });
    Ok(())
}
pub(crate) fn send(state: &AppState, vault_id: &str, id: &str, input: Input) -> Result<(), Error> {
    let _scope = session_scope(state, vault_id)?;
    state
        .sessions()
        .get(id)
        .ok_or(TerminalError::SessionClosed)?
        .send(input)
        .map_err(|_| TerminalError::SessionClosed)?;
    Ok(())
}
pub(crate) fn session_scope<'a>(
    state: &'a AppState,
    vault_id: &str,
) -> Result<std::sync::MutexGuard<'a, crate::vault::VaultCatalog>, Error> {
    // A switch drains sessions while holding catalog; terminal IO must not wait on the network-held vault lock.
    let catalog = state.catalog()?;
    if catalog.selected != vault_id {
        return Err(Error::VaultSwitched);
    }
    Ok(catalog)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::time::{sleep, Instant};
    use zeroize::Zeroizing;
    const LIMIT: Duration = Duration::from_millis(300);
    // What `open` does at a password step: open the question, wait for the answer, then finish.
    async fn asks_then(
        prompt: &PasswordPrompt,
        after: Duration,
        then: bool,
    ) -> Result<u8, TerminalError> {
        sleep(Duration::from_millis(50)).await;
        let answer = prompt.ask();
        answer.await.map_err(|_| TerminalError::SessionClosed)?;
        if then {
            sleep(after).await;
            return Ok(1);
        }
        std::future::pending().await
    }
    #[tokio::test]
    async fn the_timeout_waits_while_a_password_question_is_open() {
        let prompt = PasswordPrompt::default();
        let (tx, mut rx) = mpsc::unbounded_channel();
        // The question opens inside `opening`, after the timer started; the answer comes well past the limit.
        let typing = async {
            sleep(LIMIT * 3).await;
            tx.send(Input::Password(Zeroizing::new("p".into())))
                .unwrap();
        };
        let (result, ()) = tokio::join!(
            until_open(
                asks_then(&prompt, Duration::from_millis(50), true),
                &prompt,
                &mut rx,
                LIMIT
            ),
            typing
        );
        assert!(matches!(result, Ok(Some(1))));
    }
    #[tokio::test]
    async fn the_timeout_restarts_after_the_answer() {
        let prompt = PasswordPrompt::default();
        let (tx, mut rx) = mpsc::unbounded_channel();
        let answered = std::sync::Mutex::new(None);
        let typing = async {
            sleep(LIMIT * 2).await;
            *answered.lock().unwrap() = Some(Instant::now());
            tx.send(Input::Password(Zeroizing::new("p".into())))
                .unwrap();
        };
        let (result, ()) = tokio::join!(
            until_open(
                asks_then(&prompt, Duration::ZERO, false),
                &prompt,
                &mut rx,
                LIMIT
            ),
            typing
        );
        assert_eq!(result.unwrap_err().to_string(), "Timeout connessione SSH");
        let since = answered.lock().unwrap().unwrap().elapsed();
        assert!(
            since >= LIMIT - Duration::from_millis(20),
            "restarted too soon: {since:?}"
        );
    }
    #[tokio::test]
    async fn without_a_question_the_timeout_fires_and_close_wins() {
        let prompt = PasswordPrompt::default();
        let (tx, mut rx) = mpsc::unbounded_channel();
        let never = || std::future::pending::<Result<u8, TerminalError>>();
        let started = Instant::now();
        let result = until_open(never(), &prompt, &mut rx, LIMIT).await;
        assert_eq!(result.unwrap_err().to_string(), "Timeout connessione SSH");
        assert!(started.elapsed() >= LIMIT);
        tx.send(Input::Close).unwrap();
        assert!(matches!(
            until_open(never(), &prompt, &mut rx, LIMIT).await,
            Ok(None)
        ));
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
