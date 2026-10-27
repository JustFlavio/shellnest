use super::mutate;
use crate::{model, state::AppState, view::View};
use tauri::State;

#[tauri::command]
pub(crate) fn save_group(
    state: State<AppState>,
    vault_id: String,
    group: model::Group,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.upsert_group(group))
}
#[tauri::command]
pub(crate) fn delete_group(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.delete_group(&id))
}
