use super::mutate;
use crate::{
    model::{Identity, SshKey},
    state::AppState,
    view::View,
};
use tauri::State;

#[tauri::command]
pub(crate) fn save_identity(
    state: State<AppState>,
    vault_id: String,
    identity: Identity,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.upsert_identity(identity))
}
#[tauri::command]
pub(crate) fn save_key(
    state: State<AppState>,
    vault_id: String,
    key: SshKey,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.upsert_key(key))
}
#[tauri::command]
pub(crate) fn delete_identity(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.delete_identity(&id))
}
#[tauri::command]
pub(crate) fn delete_key(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.delete_key(&id))
}
