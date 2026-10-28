//! Errors of encryption, vault files and the catalog.
use crate::model::ModelError;

/// Why a vault could not be opened, sealed, stored or listed. The messages are shown to the user.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum VaultError {
    #[error("Unsupported vault version")]
    UnsupportedVersion,
    #[error("Invalid nonce")]
    InvalidNonce,
    #[error("Invalid salt")]
    InvalidSalt,
    #[error("Invalid vault")]
    Invalid,
    #[error("Wrong password or damaged vault")]
    WrongPassword,
    #[error("Invalid vault content")]
    InvalidContent,
    #[error("Use at least 12 characters for the main password")]
    PasswordTooShort,
    #[error("Encryption failed")]
    SealFailed,
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Kdf(argon2::Error),
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    #[serde(serialize_with = "crate::error::model_error")]
    Model(#[from] ModelError),
    #[error("Invalid vault registry")]
    CatalogInvalid,
    #[error("Incomplete vault registry")]
    CatalogIncomplete,
    #[error("Invalid vault identifier")]
    IdInvalid,
    #[error("Invalid vault path")]
    PathInvalid,
    #[error("The vault name must be 1 to 80 characters long")]
    NameInvalid,
    #[error("A vault with this name already exists")]
    NameTaken,
    #[error("Vault already open")]
    AlreadyOpen,
    #[error("A local vault already exists")]
    AlreadyExists,
    #[error("A password is required to create the vault")]
    PasswordRequired,
    #[error("The default vault cannot be deleted")]
    DefaultNotDeletable,
    #[error("The vault is not empty: delete its contents first")]
    NotEmpty,
    #[error("Unlock the vault to delete it")]
    LockedForDeletion,
}
