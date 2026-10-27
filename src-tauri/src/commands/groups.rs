use super::mutate;
use crate::{error::Error, model, state::AppState, view::View};
use tauri::State;

#[tauri::command]
pub(crate) fn save_group(
    state: State<AppState>,
    vault_id: String,
    group: model::Group,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| data.upsert_group(group))
}
#[tauri::command]
pub(crate) fn delete_group(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| data.delete_group(&id))
}
