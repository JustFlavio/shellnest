use super::SftpError;
use crate::{
    error::{Error, coded},
    locks::MutexExt,
    model::Connection,
    ssh,
    state::AppState,
    terminal::{self, Input, TerminalError},
};
use russh_sftp::client::SftpSession;
use serde::Serialize;
use std::{
    collections::HashMap,
    future::Future,
    sync::{Arc, Mutex, OnceLock},
    time::Duration,
};
use tauri::{Manager, ipc::Channel};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

pub(crate) type Registry = Mutex<HashMap<String, Arc<Session>>>;
#[derive(Serialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub(crate) enum Event {
    Ready,
    Password(bool),
    Error(serde_json::Value),
    Closed,
    Transfer(super::transfer::Progress),
}
pub(crate) struct Session {
    pub(super) client: OnceLock<SftpSession>,
    pub(super) cancel: CancellationToken,
    pub(super) jobs: Mutex<HashMap<String, CancellationToken>>,
    pub(super) operations: tokio::sync::Mutex<()>,
    pub(super) output: Channel<Event>,
}
impl Session {
    pub(super) fn client(&self) -> Result<&SftpSession, SftpError> {
        if self.cancel.is_cancelled() {
            return Err(SftpError::Cancelled);
        }
        self.client.get().ok_or(SftpError::NotConnected)
    }
    pub(super) async fn cancellable<T>(
        &self,
        operation: impl Future<Output = Result<T, SftpError>>,
    ) -> Result<T, SftpError> {
        tokio::select! { biased; _ = self.cancel.cancelled() => Err(SftpError::Cancelled), result = operation => result }
    }
    pub(crate) fn cancel_transfer(&self, id: &str) {
        if let Some(token) = self.jobs.lock_recovering().get(id) {
            token.cancel();
        }
    }
}
pub(crate) fn get(state: &AppState, vault_id: &str, id: &str) -> Result<Arc<Session>, Error> {
    let _scope = terminal::session_scope(state, vault_id)?;
    if !state.sessions().contains_key(id) {
        return Err(SftpError::NotConnected.into());
    }
    state
        .sftp
        .lock_recovering()
        .get(id)
        .cloned()
        .ok_or_else(|| SftpError::NotConnected.into())
}
pub(crate) fn close_all(state: &AppState) {
    for (_, session) in state.sftp.lock_recovering().drain() {
        session.cancel.cancel();
    }
}
pub(crate) fn close(state: &AppState, vault_id: &str, id: &str) -> Result<(), Error> {
    let _scope = terminal::session_scope(state, vault_id)?;
    let Some(session) = state.sftp.lock_recovering().remove(id) else {
        return Ok(());
    };
    session.cancel.cancel();
    if let Some(tx) = state.sessions().remove(id) {
        let _ = tx.send(Input::Close);
    }
    Ok(())
}
pub(crate) fn open(
    app: tauri::AppHandle,
    state: &AppState,
    id: String,
    host: Connection,
    output: Channel<Event>,
) -> Result<(), Error> {
    let mut sessions = state.sessions();
    if id.is_empty() || id.len() > 80 || sessions.contains_key(&id) {
        return Err(TerminalError::SessionIdInvalidOrOpen.into());
    }
    let session = Arc::new(Session {
        client: OnceLock::new(),
        cancel: CancellationToken::new(),
        jobs: Mutex::new(HashMap::new()),
        operations: tokio::sync::Mutex::new(()),
        output,
    });
    let (tx, mut rx) = mpsc::unbounded_channel();
    sessions.insert(id.clone(), tx.clone());
    state
        .sftp
        .lock_recovering()
        .insert(id.clone(), session.clone());
    tauri::async_runtime::spawn(async move {
        let _closing = Closing {
            app,
            id,
            tx,
            session: session.clone(),
        };
        let prompt = terminal::PasswordPrompt::default();
        let opening = ssh::authenticate(
            &host,
            |_| {},
            |refused| {
                let answer = prompt.ask();
                let _ = session.output.send(Event::Password(refused));
                async move { answer.await.ok() }
            },
        );
        let result = tokio::select! { biased; _ = session.cancel.cancelled() => return, result = terminal::until_open(opening, &prompt, &mut rx, Duration::from_secs(30)) => result };
        let mut transport = match result {
            Ok(Some(transport)) => transport,
            Ok(None) => return,
            Err(e) => {
                let _ = session.output.send(Event::Error(coded("terminal", &e)));
                return;
            }
        };
        drop(host);
        // The vault lock may have queued Close immediately after authentication completed.
        let setup = async {
            let mut channel = transport
                .channel_open_session()
                .await
                .map_err(TerminalError::from)?;
            channel
                .request_subsystem(true, "sftp")
                .await
                .map_err(TerminalError::from)?;
            loop {
                match channel.wait().await {
                    Some(russh::ChannelMsg::Success) => break,
                    Some(
                        russh::ChannelMsg::Failure
                        | russh::ChannelMsg::Close
                        | russh::ChannelMsg::Eof,
                    )
                    | None => return Err(SftpError::SubsystemRefused.into()),
                    _ => {}
                }
            }
            let client = SftpSession::new(channel.into_stream())
                .await
                .map_err(SftpError::from)?;
            client.set_timeout(30);
            let _ = session.client.set(client);
            Ok::<_, Error>(())
        };
        let result = tokio::select! { biased; _ = session.cancel.cancelled() => return, _ = rx.recv() => return, result = tokio::time::timeout(Duration::from_secs(30), setup) => result };
        match result {
            Ok(Ok(())) => {
                let _ = session.output.send(Event::Ready);
            }
            Ok(Err(e)) => {
                let _ = session.output.send(Event::Error(e.message()));
                return;
            }
            Err(_) => {
                let _ = session.output.send(Event::Error(coded(
                    "terminal",
                    &TerminalError::ConnectTimeout,
                )));
                return;
            }
        }
        loop {
            tokio::select! {
                _ = session.cancel.cancelled() => break,
                result = &mut transport => {
                    if let Err(e) = result { let _ = session.output.send(Event::Error(coded("terminal", &TerminalError::from(e)))); }
                    break;
                },
                input = rx.recv() => if matches!(input, Some(Input::Close) | None) { break; }
            }
        }
        session.cancel.cancel();
        // Let in-flight copies remove staging or finish a rollback before closing their channel.
        let _operations =
            tokio::time::timeout(Duration::from_secs(35), session.operations.lock()).await;
        if let Some(client) = session.client.get() {
            let _ = client.close().await;
        }
        let _ = transport
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
    });
    Ok(())
}
struct Closing {
    app: tauri::AppHandle,
    id: String,
    tx: mpsc::UnboundedSender<Input>,
    session: Arc<Session>,
}
impl Drop for Closing {
    fn drop(&mut self) {
        self.session.cancel.cancel();
        let state = self.app.state::<AppState>();
        let mut sessions = state.sessions();
        if sessions
            .get(&self.id)
            .is_some_and(|tx| tx.same_channel(&self.tx))
        {
            sessions.remove(&self.id);
        }
        let mut registry = state.sftp.lock_recovering();
        if registry
            .get(&self.id)
            .is_some_and(|current| Arc::ptr_eq(current, &self.session))
        {
            registry.remove(&self.id);
        }
        let _ = self.session.output.send(Event::Closed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vault_shutdown_cancels_sftp_and_stale_scope_cannot_reach_it() {
        let root = std::env::temp_dir().join(format!("shellnest-scope-{}", crate::model::new_id()));
        let state = AppState::new(root.clone()).unwrap();
        let session = Arc::new(Session {
            client: OnceLock::new(),
            cancel: CancellationToken::new(),
            jobs: Mutex::new(HashMap::new()),
            operations: tokio::sync::Mutex::new(()),
            output: Channel::new(|_| Ok(())),
        });
        let (tx, mut rx) = mpsc::unbounded_channel();
        state.sessions().insert("files".into(), tx);
        state
            .sftp
            .lock_recovering()
            .insert("files".into(), session.clone());
        assert!(get(&state, "personal", "files").is_ok());
        assert!(matches!(
            get(&state, "another-vault", "files"),
            Err(Error::VaultSwitched)
        ));
        state.close_sessions();
        assert!(session.cancel.is_cancelled());
        assert!(state.sftp.lock_recovering().is_empty());
        assert!(matches!(rx.try_recv(), Ok(Input::Close)));
        assert!(get(&state, "personal", "files").is_err());
        if root.exists() {
            std::fs::remove_dir_all(root).unwrap();
        }
    }
}
