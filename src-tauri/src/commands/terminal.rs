use crate::{
    local,
    state::{commit, AppState},
    terminal::{probe, register, send, session_scope, Input, Output},
};
use std::sync::Arc;
use tauri::{ipc::Channel, Manager, State};
use zeroize::Zeroizing;

#[tauri::command]
pub(crate) async fn probe_host(
    app: tauri::AppHandle,
    vault_id: String,
    id: String,
) -> Result<String, String> {
    let (host, port) = {
        let state = app.state::<AppState>();
        let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
        state.ensure_vault(&vault_id)?;
        let data = &guard.as_ref().ok_or("Vault bloccato")?.data;
        let host = data
            .hosts
            .iter()
            .find(|h| h.id == id)
            .cloned()
            .ok_or("Host non trovato")?;
        let port = data.effective_port(&host);
        (host, port)
    };
    probe(&host.address, port).await
}
#[tauri::command]
pub(crate) async fn probe_target(
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
    crate::model::validate_endpoint(&address, port)?;
    probe(&address, port).await
}
#[tauri::command]
pub(crate) fn trust_host(
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
    let effective = data
        .hosts
        .iter()
        .find(|h| h.id == id)
        .map(|h| data.effective_port(h))
        .ok_or("Host non trovato")?;
    let host = data
        .hosts
        .iter_mut()
        .find(|h| h.id == id)
        .ok_or("Host non trovato")?;
    if !host.fingerprint.is_empty() {
        return Err("Questo host ha già un’impronta salvata".into());
    }
    if host.address != address || effective != port {
        return Err("La destinazione è cambiata. Ripeti la verifica dell’impronta.".into());
    }
    host.fingerprint = expected;
    commit(&state, v, data)
}
#[tauri::command]
pub(crate) fn connect(
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
// The argument list is the IPC contract with the frontend, so it cannot be grouped into a struct.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub(crate) fn connect_quick(
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
    crate::model::validate_endpoint(&address, port)?;
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
#[tauri::command]
pub(crate) fn terminal_input(
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
pub(crate) fn terminal_password(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    password: String,
) -> Result<(), String> {
    let password = Zeroizing::new(password);
    if password.len() > 1024 {
        return Err("Password troppo lunga".into());
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
) -> Result<(), String> {
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
#[tauri::command]
pub(crate) fn connect_local(
    state: State<AppState>,
    vault_id: String,
    session_id: String,
    output: Channel<Output>,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    guard.as_ref().ok_or("Vault bloccato")?;
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "Sessioni non disponibili")?;
    if session_id.is_empty() || session_id.len() > 80 || sessions.contains_key(&session_id) {
        return Err("Identificativo sessione non valido o già aperto".into());
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
