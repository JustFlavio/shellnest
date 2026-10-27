//! Errors of encryption, vault files and the catalog.
use crate::model::ModelError;

/// Why a vault could not be opened, sealed, stored or listed. The messages are shown to the user.
#[derive(Debug, thiserror::Error)]
pub(crate) enum VaultError {
    #[error("Versione vault non supportata")]
    UnsupportedVersion,
    #[error("Nonce non valido")]
    InvalidNonce,
    #[error("Salt non valido")]
    InvalidSalt,
    #[error("Vault non valido")]
    Invalid,
    #[error("Password errata o vault danneggiato")]
    WrongPassword,
    #[error("Contenuto vault non valido")]
    InvalidContent,
    #[error("Usa almeno 12 caratteri per la password principale")]
    PasswordTooShort,
    #[error("Cifratura fallita")]
    SealFailed,
    #[error("{0}")]
    Kdf(argon2::Error),
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Model(#[from] ModelError),
    #[error("Registro vault non valido")]
    CatalogInvalid,
    #[error("Registro vault incompleto")]
    CatalogIncomplete,
    #[error("Identificativo vault non valido")]
    IdInvalid,
    #[error("Percorso vault non valido")]
    PathInvalid,
    #[error("Il nome del vault deve contenere da 1 a 80 caratteri")]
    NameInvalid,
    #[error("Esiste già un vault con questo nome")]
    NameTaken,
    #[error("Vault già aperto")]
    AlreadyOpen,
    #[error("Esiste già un vault locale")]
    AlreadyExists,
    #[error("Serve la password per creare il vault")]
    PasswordRequired,
    #[error("Il vault Personale non può essere eliminato")]
    DefaultNotDeletable,
    #[error("Il vault non è vuoto: eliminane prima il contenuto")]
    NotEmpty,
    #[error("Sblocca il vault per eliminarlo")]
    LockedForDeletion,
}
