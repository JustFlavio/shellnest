//! The one error type the commands return.
//!
//! Each area owns an enum (`ModelError`, `VaultError`, `KeychainError`, `SyncError`, `TerminalError`).
//! `Display` is English and only for logs; the UI receives `{ code, params }` and translates the code,
//! which `coded` prefixes with the area (`model.HostNotFound`).
use crate::{
    keychain::KeychainError, model::ModelError, sync::SyncError, terminal::TerminalError,
    vault::VaultError,
};
use serde::{Serialize, Serializer};
use serde_json::{Value, json};

#[derive(Debug, thiserror::Error)]
pub(crate) enum Error {
    #[error(transparent)]
    Sftp(#[from] crate::sftp::SftpError),
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
    #[error("State not available")]
    StatePoisoned,
    #[error("Vault registry not available")]
    CatalogPoisoned,
    #[error("Vault locked")]
    VaultLocked,
    #[error("Vault not found")]
    VaultNotFound,
    #[error("The active vault has changed. Repeat the operation in the right vault.")]
    VaultSwitched,
    #[error("This host has no private password saved")]
    NoPrivatePassword,
    // The blocking task of a command panicked or was cancelled.
    #[error("{0}")]
    Task(#[from] tauri::Error),
}
impl Error {
    /// The error as the UI receives it.
    pub(crate) fn message(&self) -> Value {
        let own = |code: &str| json!({ "code": format!("app.{code}") });
        match self {
            Self::Sftp(e) => coded("sftp", e),
            Self::Model(e) => coded("model", e),
            Self::Vault(e) => coded("vault", e),
            Self::Keychain(e) => coded("keychain", e),
            Self::Sync(e) => coded("sync", e),
            Self::Terminal(e) => coded("terminal", e),
            Self::StatePoisoned => own("StatePoisoned"),
            Self::CatalogPoisoned => own("CatalogPoisoned"),
            Self::VaultLocked => own("VaultLocked"),
            Self::VaultNotFound => own("VaultNotFound"),
            Self::VaultSwitched => own("VaultSwitched"),
            Self::NoPrivatePassword => own("NoPrivatePassword"),
            Self::Task(e) => json!({ "code": "app.Task", "params": e.to_string() }),
        }
    }
}
/// An area error as `{ code, params }`, the code prefixed with the area.
pub(crate) fn coded<E: Serialize>(area: &str, error: &E) -> Value {
    let mut value = serde_json::to_value(error).unwrap_or_else(|_| json!({ "code": "Unknown" }));
    // A vault error can wrap a model error, which already carries its own area.
    if value["code"] == "Model" {
        return value["params"].take();
    }
    value["code"] = format!("{area}.{}", value["code"].as_str().unwrap_or("Unknown")).into();
    value
}
// serde helpers for variants that wrap a library error: only its text is sent.
pub(crate) fn as_text<T: std::fmt::Display, S: Serializer>(
    error: &T,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.collect_str(error)
}
pub(crate) fn status_code<S: Serializer>(
    status: &reqwest::StatusCode,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_u16(status.as_u16())
}
pub(crate) fn model_error<S: Serializer>(
    error: &ModelError,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    coded("model", error).serialize(serializer)
}
// Tauri sends a command error to the UI as its JSON form.
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.message().serialize(serializer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn an_error_reaches_the_ui_as_a_code() {
        let json = serde_json::to_string(&Error::from(ModelError::HostNotFound)).unwrap();
        assert_eq!(json, r#"{"code":"model.HostNotFound"}"#);
        let json = serde_json::to_string(&Error::VaultSwitched).unwrap();
        assert_eq!(json, r#"{"code":"app.VaultSwitched"}"#);
    }
    #[test]
    fn a_value_travels_as_params() {
        let json = serde_json::to_string(&Error::from(ModelError::GroupTooDeep(3))).unwrap();
        assert_eq!(json, r#"{"code":"model.GroupTooDeep","params":3}"#);
    }
    #[test]
    fn a_wrapped_model_error_keeps_its_own_area() {
        let error = Error::from(VaultError::from(ModelError::KeyInUse(2)));
        let json = serde_json::to_string(&error).unwrap();
        assert_eq!(json, r#"{"code":"model.KeyInUse","params":2}"#);
    }
    #[test]
    fn a_library_error_travels_as_its_text() {
        let io = std::io::Error::other("disk full");
        let json = serde_json::to_string(&Error::from(VaultError::from(io))).unwrap();
        assert_eq!(json, r#"{"code":"vault.Io","params":"disk full"}"#);
    }
}
