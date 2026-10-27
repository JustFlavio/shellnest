//! The vault key lives in the OS keychain (macOS Keychain, Windows Credential Manager), one entry per vault.
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod native;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod unsupported;

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub(crate) use native::{forget, load, save};
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(crate) use unsupported::{forget, load, save};
