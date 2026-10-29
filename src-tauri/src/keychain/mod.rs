//! The vault key lives in the OS keychain (macOS Keychain, Windows Credential Manager, the Secret Service on Linux), one entry per vault.
#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
mod native;
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod unsupported;

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
pub(crate) use native::{forget, load, save};
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
pub(crate) use unsupported::{forget, load, save};

/// Why the vault key could not be stored in or read from the keychain.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum KeychainError {
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Keyring(#[from] keyring::Error),
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Encoding(#[from] base64::DecodeError),
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    #[error("Invalid saved key")]
    InvalidKey,
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    #[error("Keychain not available on this system")]
    Unsupported,
}
