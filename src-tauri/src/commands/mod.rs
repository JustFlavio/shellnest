//! Tauri commands, one file per area. Every command that changes the vault returns the fresh
//! `View`, so the UI never holds state of its own.
pub(crate) mod credentials;
pub(crate) mod groups;
pub(crate) mod hosts;
pub(crate) mod sftp;
pub(crate) mod sync;
pub(crate) mod system;
pub(crate) mod terminal;
pub(crate) mod unlock;
pub(crate) mod vaults;
pub(crate) mod workspaces;

use crate::{
    error::Error,
    model::{Data, ModelError},
    state::{AppState, commit},
    view::{View, view},
};

/// Applies `operation` to a copy of the open vault and persists it before swapping it in, so a
/// failed edit or write leaves both memory and disk untouched.
pub(crate) fn mutate(
    state: &AppState,
    vault_id: &str,
    operation: impl FnOnce(&mut Data) -> Result<(), ModelError>,
) -> Result<View, Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    let mut data = v.data.clone();
    operation(&mut data)?;
    commit(state, v, data)?;
    drop(guard);
    view(state)
}
