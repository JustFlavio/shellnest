//! The vault key lives in the OS keychain (macOS Keychain, Windows Credential Manager), one entry per vault.
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod native;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod unsupported;

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub(crate) use native::{forget, load, save};
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(crate) use unsupported::{forget, load, save};

/// Why the vault key could not be stored in or read from the keychain.
#[derive(Debug, thiserror::Error)]
pub(crate) enum KeychainError {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    #[error("{0}")]
    Keyring(#[from] keyring::Error),
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    #[error("{0}")]
    Encoding(#[from] base64::DecodeError),
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    #[error("Chiave salvata non valida")]
    InvalidKey,
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    #[error("Portachiavi non disponibile su questo sistema")]
    Unsupported,
}
