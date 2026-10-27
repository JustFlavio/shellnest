use super::mutate;
use crate::{error::Error, model, state::AppState, view::View};
use tauri::State;

#[tauri::command]
pub(crate) fn save_workspace(
    state: State<AppState>,
    vault_id: String,
    workspace: model::Workspace,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| data.upsert_workspace(workspace))
}
#[tauri::command]
pub(crate) fn delete_workspace(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, Error> {
    mutate(&state, &vault_id, |data| {
        data.delete_workspace(&id);
        Ok(())
    })
}
