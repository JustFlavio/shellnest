use crate::{
    account::api::Role,
    error::Error,
    state::AppState,
    sync::{
        members::{self, MemberView, Removal},
        synchronize, vaults,
    },
    view::View,
};
use tauri::Manager;

// Each command talks to the server, so it runs off the async runtime.
async fn blocking<T: Send + 'static>(
    app: tauri::AppHandle,
    task: impl FnOnce(&AppState) -> Result<T, Error> + Send + 'static,
) -> Result<T, Error> {
    tauri::async_runtime::spawn_blocking(move || task(&app.state::<AppState>()))
        .await
        .map_err(Error::from)?
}

#[tauri::command]
pub(crate) async fn sync_vault(app: tauri::AppHandle, vault_id: String) -> Result<View, Error> {
    blocking(app, move |s| synchronize(s, &vault_id)).await
}
#[tauri::command]
pub(crate) async fn upload_vault(app: tauri::AppHandle, vault_id: String) -> Result<View, Error> {
    let view = blocking(app, {
        let vault_id = vault_id.clone();
        move |s| vaults::upload(s, &vault_id)
    })
    .await?;
    // The key of the local password no longer opens the vault.
    crate::keychain::forget(&vault_id);
    Ok(view)
}
#[tauri::command]
pub(crate) async fn leave_vault(app: tauri::AppHandle, vault_id: String) -> Result<View, Error> {
    blocking(app, move |s| vaults::leave(s, &vault_id)).await
}
#[tauri::command]
pub(crate) async fn vault_members(
    app: tauri::AppHandle,
    vault_id: String,
) -> Result<Vec<MemberView>, Error> {
    blocking(app, move |s| members::members(s, &vault_id)).await
}
#[tauri::command]
pub(crate) async fn add_member(
    app: tauri::AppHandle,
    vault_id: String,
    username: String,
    role: Role,
) -> Result<Vec<MemberView>, Error> {
    blocking(app, move |s| members::add(s, &vault_id, &username, role)).await
}
#[tauri::command]
pub(crate) async fn set_member_role(
    app: tauri::AppHandle,
    vault_id: String,
    user_id: String,
    role: Role,
) -> Result<Vec<MemberView>, Error> {
    blocking(app, move |s| {
        members::set_role(s, &vault_id, &user_id, role)
    })
    .await
}
#[tauri::command]
pub(crate) async fn remove_member(
    app: tauri::AppHandle,
    vault_id: String,
    user_id: String,
) -> Result<Removal, Error> {
    blocking(app, move |s| members::remove(s, &vault_id, &user_id)).await
}
#[tauri::command(async)]
pub(crate) fn share_identity(
    state: tauri::State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, Error> {
    members::share_identity(&state, &vault_id, &id)
}
