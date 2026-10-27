use crate::{
    error::Error,
    state::AppState,
    sync::{restore, synchronize, SyncError},
    vault::{self, OpenVault},
    view::{view, View},
};
use tauri::{Manager, State};

#[tauri::command(async)]
pub(crate) fn configure_sync(
    state: State<AppState>,
    vault_id: String,
    url: String,
    token: String,
) -> Result<View, Error> {
    crate::sync::endpoint_for_vault(&url, &vault_id)?;
    let mut guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    let mut data = v.data.clone();
    let changed_endpoint = data.sync_url != url.trim_end_matches('/');
    data.sync_url = url.trim_end_matches('/').into();
    if !token.is_empty() {
        data.sync_token = token;
    }
    if data.sync_token.len() < 32 {
        return Err(SyncError::TokenTooShort.into());
    }
    let mut candidate = OpenVault {
        key: v.key.clone(),
        data,
        disk: v.disk.clone(),
    };
    if changed_endpoint {
        candidate.disk.revision = None;
    }
    candidate.disk.dirty = true;
    candidate.seal()?;
    vault::save(&state.active_path()?, &candidate.disk)?;
    *v = candidate;
    drop(guard);
    view(&state)
}

#[tauri::command]
pub(crate) async fn sync_vault(app: tauri::AppHandle, vault_id: String) -> Result<View, Error> {
    tauri::async_runtime::spawn_blocking(move || synchronize(&app.state::<AppState>(), &vault_id))
        .await
        .map_err(Error::from)?
}
#[tauri::command]
pub(crate) async fn restore_vault(
    app: tauri::AppHandle,
    vault_id: String,
    url: String,
    token: String,
    password: String,
) -> Result<View, Error> {
    let password = zeroize::Zeroizing::new(password);
    let token = zeroize::Zeroizing::new(token);
    tauri::async_runtime::spawn_blocking(move || {
        restore(&app.state::<AppState>(), &vault_id, &url, &token, &password)
    })
    .await
    .map_err(Error::from)?
}
