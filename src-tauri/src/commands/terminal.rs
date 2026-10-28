use crate::{
    error::Error,
    local,
    model::ModelError,
    state::{AppState, commit},
    terminal::{Input, Output, TerminalError, probe, register, send, session_scope},
};
use std::sync::Arc;
use tauri::{Manager, State, ipc::Channel};
use zeroize::Zeroizing;

#[tauri::command]
pub(crate) async fn probe_host(
    app: tauri::AppHandle,
    vault_id: String,
    id: String,
) -> Result<String, Error> {
    let (host, port) = {
        let state = app.state::<AppState>();
        let guard = state.vault()?;
        state.ensure_vault(&vault_id)?;
        let data = &guard.as_ref().ok_or(Error::VaultLocked)?.data;
        let host = data
            .hosts
            .iter()
            .find(|h| h.id == id)
            .cloned()
            .ok_or(ModelError::HostNotFound)?;
        let port = data.effective_port(&host);
        (host, port)
    };
    Ok(probe(&host.address, port).await?)
}
#[tauri::command]
pub(crate) async fn probe_target(
    app: tauri::AppHandle,
    vault_id: String,
    address: String,
    port: u16,
) -> Result<String, Error> {
    {
        let state = app.state::<AppState>();
        let guard = state.vault()?;
        state.ensure_vault(&vault_id)?;
        guard.as_ref().ok_or(Error::VaultLocked)?;
    }
    crate::model::validate_endpoint(&address, port)?;
    Ok(probe(&address, port).await?)
}
#[tauri::command(async)]
pub(crate) fn trust_host(
    state: State<AppState>,
    vault_id: String,
    id: String,
    expected: String,
    address: String,
    port: u16,
) -> Result<(), Error> {
    if !expected.starts_with("SHA256:") || expected.len() != 50 {
        return Err(TerminalError::FingerprintInvalid.into());
    }
    let mut guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    let mut data = v.data.clone();
    let effective = data
        .hosts
        .iter()
        .find(|h| h.id == id)
        .map(|h| data.effective_port(h))
        .ok_or(ModelError::HostNotFound)?;
    let host = data
        .hosts
        .iter_mut()
        .find(|h| h.id == id)
        .ok_or(ModelError::HostNotFound)?;
    if !host.fingerprint.is_empty() {
        return Err(TerminalError::FingerprintAlreadySaved.into());
    }
    if host.address != address || effective != port {
        return Err(TerminalError::DestinationChanged.into());
    }
    host.fingerprint = expected;
    commit(&state, v, data)
}
#[tauri::command(async)]
pub(crate) fn connect(
    app: tauri::AppHandle,
    state: State<AppState>,
    vault_id: String,
    id: String,
    session_id: String,
    output: Channel<Output>,
) -> Result<(), Error> {
    let guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let host = guard
        .as_ref()
        .ok_or(Error::VaultLocked)?
        .data
        .resolve(&id)?;
    if host.host.fingerprint.is_empty() {
        return Err(ModelError::FingerprintUnverified.into());
    }
    Ok(register(
        app, &state, vault_id, session_id, host, true, output,
    )?)
}
// The argument list is the IPC contract with the frontend, so it cannot be grouped into a struct.
#[allow(clippy::too_many_arguments)]
#[tauri::command(async)]
pub(crate) fn connect_quick(
    app: tauri::AppHandle,
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    address: String,
    port: u16,
    identity_id: String,
    username: Option<String>,
    key_id: String,
    password: Option<String>,
    expected_fingerprint: String,
    output: Channel<Output>,
) -> Result<(), Error> {
    let password = Zeroizing::new(password.unwrap_or_default());
    if password.len() > 1024 {
        return Err(TerminalError::PasswordTooLong.into());
    }
    crate::model::validate_endpoint(&address, port)?;
    let guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let connection = guard
        .as_ref()
        .ok_or(Error::VaultLocked)?
        .data
        .resolve_target(
            &address,
            port,
            &identity_id,
            username.as_deref(),
            (&key_id, password.as_str()),
            &expected_fingerprint,
        )?;
    Ok(register(
        app, &state, vault_id, session_id, connection, false, output,
    )?)
}
#[tauri::command]
pub(crate) fn terminal_input(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    data: String,
) -> Result<(), Error> {
    if data.len() > 65536 {
        return Err(TerminalError::InputTooLarge.into());
    }
    send(
        &state,
        &vault_id,
        &session_id,
        Input::Data(data.into_bytes()),
    )
}
#[tauri::command]
pub(crate) fn terminal_password(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    password: String,
) -> Result<(), Error> {
    let password = Zeroizing::new(password);
    if password.len() > 1024 {
        return Err(TerminalError::PasswordTooLong.into());
    }
    send(&state, &vault_id, &session_id, Input::Password(password))
}
#[tauri::command]
pub(crate) fn terminal_resize(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), Error> {
    send(
        &state,
        &vault_id,
        &session_id,
        Input::Resize(cols.clamp(1, 1000), rows.clamp(1, 1000)),
    )
}
#[tauri::command]
pub(crate) fn disconnect(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
) -> Result<(), Error> {
    let _scope = session_scope(&state, &vault_id)?;
    if let Some(tx) = state.sessions().remove(&session_id) {
        let _ = tx.send(Input::Close);
    }
    Ok(())
}
#[tauri::command(async)]
pub(crate) fn connect_local(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    output: Channel<Output>,
    cols: u32,
    rows: u32,
) -> Result<(), Error> {
    let guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    guard.as_ref().ok_or(Error::VaultLocked)?;
    let mut sessions = state.sessions();
    if session_id.is_empty() || session_id.len() > 80 || sessions.contains_key(&session_id) {
        return Err(TerminalError::SessionIdInvalidOrOpen.into());
    }
    let tx = local::start(
        session_id.clone(),
        local::shell_command(),
        cols,
        rows,
        Arc::new(move |event| output.send(event).is_ok()),
    )?;
    sessions.insert(session_id, tx);
    Ok(())
}
