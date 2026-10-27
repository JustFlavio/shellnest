use super::mutate;
use crate::{
    error::Error,
    model::{Identity, SshKey},
    state::AppState,
    view::View,
};
use tauri::State;

#[tauri::command(async)]
pub(crate) fn save_identity(
    state: State<AppState>,
    vault_id: String,
    identity: Identity,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| data.upsert_identity(identity))
}
#[tauri::command(async)]
pub(crate) fn save_key(
    state: State<AppState>,
    vault_id: String,
    key: SshKey,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| data.upsert_key(key))
}
#[tauri::command(async)]
pub(crate) fn delete_identity(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| data.delete_identity(&id))
}
#[tauri::command(async)]
pub(crate) fn delete_key(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| data.delete_key(&id))
}
