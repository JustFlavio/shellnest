//! The one error type the commands return.
//!
//! Each area owns an enum (`ModelError`, `VaultError`, `KeychainError`, `SyncError`) whose `Display`
//! is the Italian message the UI shows. `Error` wraps them and serializes as that plain string, so
//! the frontend receives exactly what it did when every error was a `String`.
use crate::{
    keychain::KeychainError, model::ModelError, sync::SyncError, terminal::TerminalError,
    vault::VaultError,
};
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub(crate) enum Error {
    #[error(transparent)]
    Model(#[from] ModelError),
    #[error(transparent)]
    Vault(#[from] VaultError),
    #[error(transparent)]
    Keychain(#[from] KeychainError),
    #[error(transparent)]
    Sync(#[from] SyncError),
    #[error(transparent)]
    Terminal(#[from] TerminalError),
    #[error("Stato non disponibile")]
    StatePoisoned,
    #[error("Registro vault non disponibile")]
    CatalogPoisoned,
    #[error("Vault bloccato")]
    VaultLocked,
    #[error("Vault non trovato")]
    VaultNotFound,
    #[error("Il vault attivo è cambiato. Ripeti l’operazione nel vault corretto.")]
    VaultSwitched,
    #[error("Questo host non ha una password privata salvata")]
    NoPrivatePassword,
    // The blocking task of a command panicked or was cancelled.
    #[error("{0}")]
    Task(#[from] tauri::Error),
}
// Tauri sends a command error to the UI as its JSON form.
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn an_error_reaches_the_ui_as_its_plain_message() {
        let json = serde_json::to_string(&Error::from(ModelError::HostNotFound)).unwrap();
        assert_eq!(json, "\"Host non trovato\"");
        let json = serde_json::to_string(&Error::VaultSwitched).unwrap();
        assert_eq!(
            json,
            "\"Il vault attivo è cambiato. Ripeti l’operazione nel vault corretto.\""
        );
    }
}
