use crate::{
    state::AppState,
    sync::{restore, synchronize},
    vault::{self, OpenVault},
    view::{view, View},
};
use tauri::{Manager, State};

#[tauri::command]
pub(crate) fn configure_sync(
    state: State<AppState>,
    vault_id: String,
    url: String,
    token: String,
) -> Result<View, String> {
    crate::sync::endpoint_for_vault(&url, &vault_id)?;
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_mut().ok_or("Vault bloccato")?;
    let mut data = v.data.clone();
    let changed_endpoint = data.sync_url != url.trim_end_matches('/');
    data.sync_url = url.trim_end_matches('/').into();
    if !token.is_empty() {
        data.sync_token = token;
    }
    if data.sync_token.len() < 32 {
        return Err("Il token deve avere almeno 32 caratteri".into());
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
pub(crate) async fn sync_vault(app: tauri::AppHandle, vault_id: String) -> Result<View, String> {
    tauri::async_runtime::spawn_blocking(move || synchronize(&app.state::<AppState>(), &vault_id))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) async fn restore_vault(
    app: tauri::AppHandle,
    vault_id: String,
    url: String,
    token: String,
    password: String,
) -> Result<View, String> {
    let password = zeroize::Zeroizing::new(password);
    tauri::async_runtime::spawn_blocking(move || {
        restore(&app.state::<AppState>(), &vault_id, &url, &token, &password)
    })
    .await
    .map_err(|e| e.to_string())?
}
