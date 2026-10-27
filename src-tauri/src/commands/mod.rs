//! Tauri commands, one file per area. Every command that changes the vault returns the fresh
//! `View`, so the UI never holds state of its own.
pub(crate) mod credentials;
pub(crate) mod groups;
pub(crate) mod hosts;
pub(crate) mod sync;
pub(crate) mod system;
pub(crate) mod terminal;
pub(crate) mod unlock;
pub(crate) mod vaults;
pub(crate) mod workspaces;

use crate::{
    model::Data,
    state::{commit, AppState},
    view::{view, View},
};

pub(crate) fn mutate(
    state: &AppState,
    vault_id: &str,
    operation: impl FnOnce(&mut Data) -> Result<(), String>,
) -> Result<View, String> {
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_mut().ok_or("Vault bloccato")?;
    let mut data = v.data.clone();
    operation(&mut data)?;
    commit(state, v, data)?;
    drop(guard);
    view(state)
}
