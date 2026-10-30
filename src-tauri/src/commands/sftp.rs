//! IPC validation and vault scoping; file and transfer logic belongs to `sftp`.
use crate::{
    error::Error,
    model::ModelError,
    sftp::{self, Directory, Event, Mutation, Side, TransferRequest},
    state::AppState,
    terminal::{self, Input, TerminalError},
};
use tauri::{Manager, State, ipc::Channel};
use zeroize::Zeroizing;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QuickTarget {
    address: String,
    port: u16,
    username: Option<String>,
    login: QuickLogin,
    expected_fingerprint: String,
}
#[derive(serde::Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub(crate) enum ConnectTarget {
    Saved {
        id: String,
        expected: sftp::ExpectedTarget,
    },
    Quick(QuickTarget),
}
#[derive(serde::Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum QuickLogin {
    Identity { id: String },
    Key { id: String },
    Password,
}

#[tauri::command(async)]
pub(crate) fn sftp_connect(
    app: tauri::AppHandle,
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    target: ConnectTarget,
    output: Channel<Event>,
) -> Result<(), Error> {
    let guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let data = &guard.as_ref().ok_or(Error::VaultLocked)?.data;
    let connection = match target {
        ConnectTarget::Saved { id, expected } => {
            let connection = data.resolve(&id)?;
            expected.verify(&connection)?;
            connection
        }
        ConnectTarget::Quick(target) => {
            crate::model::validate_endpoint(&target.address, target.port)?;
            let (identity, key) = match &target.login {
                QuickLogin::Identity { id } => (id.as_str(), ""),
                QuickLogin::Key { id } => ("", id.as_str()),
                QuickLogin::Password => ("", ""),
            };
            data.resolve_target(
                &target.address,
                target.port,
                identity,
                target.username.as_deref(),
                (key, ""),
                &target.expected_fingerprint,
            )?
        }
    };
    if connection.host.fingerprint.is_empty() {
        return Err(ModelError::FingerprintUnverified.into());
    }
    sftp::open(app, &state, session_id, connection, output)
}
#[tauri::command]
pub(crate) fn sftp_password(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    password: String,
) -> Result<(), Error> {
    let password = Zeroizing::new(password);
    if password.len() > 1024 {
        return Err(TerminalError::PasswordTooLong.into());
    }
    sftp::get(&state, &vault_id, &session_id)?;
    terminal::send(&state, &vault_id, &session_id, Input::Password(password))
}
#[tauri::command]
pub(crate) async fn sftp_list(
    app: tauri::AppHandle,
    vault_id: String,
    session_id: String,
    side: Side,
    path: String,
) -> Result<Directory, Error> {
    let session = sftp::get(&app.state::<AppState>(), &vault_id, &session_id)?;
    Ok(session.list(side, &path).await?)
}
#[tauri::command]
pub(crate) async fn sftp_mutate(
    app: tauri::AppHandle,
    vault_id: String,
    session_id: String,
    side: Side,
    mutation: Mutation,
) -> Result<(), Error> {
    let session = sftp::get(&app.state::<AppState>(), &vault_id, &session_id)?;
    Ok(session.mutate(side, mutation).await?)
}
#[tauri::command]
pub(crate) fn sftp_transfer(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    request: TransferRequest,
) -> Result<(), Error> {
    Ok(sftp::start_transfer(
        sftp::get(&state, &vault_id, &session_id)?,
        request,
    )?)
}
#[tauri::command]
pub(crate) fn sftp_cancel(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    id: String,
) -> Result<(), Error> {
    sftp::get(&state, &vault_id, &session_id)?.cancel_transfer(&id);
    Ok(())
}
#[tauri::command]
pub(crate) fn sftp_close(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
) -> Result<(), Error> {
    sftp::close(&state, &vault_id, &session_id)
}
