//! Signing in to a sync server and managing the account. A device holds one account at a time.
use super::{
    unlock::{Secret, open_selected},
    vaults::select,
};
use crate::{
    account::{self, OpenAccount, api::Device},
    error::Error,
    keychain,
    state::AppState,
    sync::{SyncError, vaults},
    vault::{Disk, VaultCatalog},
    view::{View, view},
};
use serde::Serialize;
use tauri::Manager;
use zeroize::Zeroizing;

/// The keychain entry of the account key, beside one entry per local vault.
pub(crate) const KEYCHAIN_ENTRY: &str = "account";

async fn blocking<T: Send + 'static>(
    app: tauri::AppHandle,
    task: impl FnOnce(&AppState) -> Result<T, Error> + Send + 'static,
) -> Result<T, Error> {
    tauri::async_runtime::spawn_blocking(move || task(&app.state::<AppState>()))
        .await
        .map_err(Error::from)?
}

// One account per device; signing in again to the same one (after a revoked session) is fine.
fn check_free(state: &AppState, server: &str, username: &str) -> Result<(), Error> {
    if let Some(file) = account::load(&state.path)? {
        let server = account::api::server_url(server)?;
        if file.username != username.trim() || file.server != server.as_str().trim_end_matches('/')
        {
            return Err(SyncError::AlreadySignedIn.into());
        }
    }
    Ok(())
}

/// Saves the account, receives its vaults and, on a device with nothing to show yet, opens one.
fn signed_in(state: &AppState, mut account: OpenAccount) -> Result<View, Error> {
    if let Some(old) = account::load(&state.path)? {
        account.file.pins = old.pins;
    }
    account::save(&state.path, &account.file)?;
    // Whatever was remembered belongs to the previous login.
    keychain::forget(KEYCHAIN_ENTRY);
    *state.account()? = Some(account);
    vaults::receive(state)?;
    let (selected, exists, first) = {
        let catalog = state.catalog()?;
        let selected = catalog.selected.clone();
        let exists = catalog.selected_path(&state.path)?.exists();
        let first = catalog
            .vaults
            .iter()
            .find(|e| e.remote.is_some())
            .map(|e| e.id.clone());
        (selected, exists, first)
    };
    let unlocked = state.vault()?.is_some();
    if !unlocked {
        let target = if exists {
            selected
        } else {
            first.unwrap_or(selected)
        };
        select(state, &target)?;
        let remote = state
            .catalog()?
            .vaults
            .iter()
            .any(|e| e.id == target && e.remote.is_some());
        if remote {
            open_selected(state, &target, Secret::Account, false)?;
        }
    }
    view(state)
}

#[tauri::command]
pub(crate) async fn sign_in(
    app: tauri::AppHandle,
    server: String,
    username: String,
    password: String,
) -> Result<View, Error> {
    let password = Zeroizing::new(password);
    blocking(app, move |s| {
        check_free(s, &server, &username)?;
        let account = OpenAccount::login(&server, username.trim(), &password)?;
        signed_in(s, account)
    })
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Registered {
    view: View,
    recovery_key: String,
}
#[tauri::command]
pub(crate) async fn register(
    app: tauri::AppHandle,
    server: String,
    invite: String,
    username: String,
    password: String,
) -> Result<Registered, Error> {
    let password = Zeroizing::new(password);
    blocking(app, move |s| {
        if account::load(&s.path)?.is_some() {
            return Err(SyncError::AlreadySignedIn.into());
        }
        let (account, recovery_key) =
            OpenAccount::register(&server, &invite, &username, &password)?;
        Ok(Registered {
            view: signed_in(s, account)?,
            recovery_key,
        })
    })
    .await
}
#[tauri::command]
pub(crate) async fn recover_account(
    app: tauri::AppHandle,
    server: String,
    username: String,
    recovery_key: String,
    password: String,
) -> Result<View, Error> {
    let password = Zeroizing::new(password);
    let recovery_key = Zeroizing::new(recovery_key);
    blocking(app, move |s| {
        check_free(s, &server, &username)?;
        let account = OpenAccount::recover(&server, &username, &recovery_key, &password)?;
        signed_in(s, account)
    })
    .await
}
#[tauri::command]
pub(crate) async fn change_password(
    app: tauri::AppHandle,
    current: String,
    password: String,
) -> Result<(), Error> {
    let current = Zeroizing::new(current);
    let password = Zeroizing::new(password);
    blocking(app, move |s| {
        let mut guard = s.account()?;
        let account = guard.as_mut().ok_or(SyncError::NotSignedIn)?;
        account.change_password(&current, &password)?;
        account::save(&s.path, &account.file)?;
        Ok(())
    })
    .await
}

/// Signs this device out. Its copies of the server vaults go too: they stay on the server and come
/// back at the next sign-in. Refused while one of them has changes not yet sent.
#[tauri::command]
pub(crate) async fn sign_out(app: tauri::AppHandle) -> Result<View, Error> {
    blocking(app, sign_out_now).await
}
fn sign_out_now(state: &AppState) -> Result<View, Error> {
    let remote: Vec<(String, std::path::PathBuf)> = state
        .catalog()?
        .vaults
        .iter()
        .filter(|e| e.remote.is_some())
        .map(|e| Ok((e.id.clone(), VaultCatalog::path_for(&state.path, &e.id)?)))
        .collect::<Result<_, Error>>()?;
    for (_, path) in &remote {
        let Ok(bytes) = std::fs::read(path) else {
            continue;
        };
        let disk: Disk =
            serde_json::from_slice(&bytes).map_err(|_| crate::vault::VaultError::Invalid)?;
        if disk.dirty || disk.remote.is_some_and(|r| r.private_dirty) {
            return Err(SyncError::UnsyncedChanges.into());
        }
    }
    if let Some(account) = state.account()?.as_ref()
        && let Ok(api) = account.api()
    {
        // Best effort: the session is dropped locally either way.
        let _ = api.logout();
    }
    let mut guard = state.vault()?;
    let mut catalog = state.catalog()?;
    let mut next = catalog.clone();
    next.vaults.retain(|e| e.remote.is_none());
    if !next.vaults.iter().any(|e| e.id == "personal") {
        next.vaults
            .insert(0, VaultCatalog::default().vaults.remove(0));
    }
    if !next.vaults.iter().any(|e| e.id == next.selected) {
        next.selected = "personal".into();
        state.close_sessions();
        *guard = None;
    }
    next.persist(&state.path)?;
    *catalog = next;
    drop(catalog);
    drop(guard);
    for (_, path) in &remote {
        vaults::remove_files(path);
    }
    account::remove(&state.path);
    keychain::forget(KEYCHAIN_ENTRY);
    *state.account()? = None;
    view(state)
}

#[tauri::command]
pub(crate) async fn devices(app: tauri::AppHandle) -> Result<Vec<Device>, Error> {
    blocking(app, |s| Ok(api_of(s)?.devices()?)).await
}
#[tauri::command]
pub(crate) async fn revoke_device(app: tauri::AppHandle, id: String) -> Result<Vec<Device>, Error> {
    blocking(app, move |s| {
        let api = api_of(s)?;
        api.revoke_device(&id)?;
        Ok(api.devices()?)
    })
    .await
}
#[tauri::command]
pub(crate) async fn create_invite(app: tauri::AppHandle, admin: bool) -> Result<String, Error> {
    blocking(app, move |s| Ok(api_of(s)?.invite(admin)?)).await
}
fn api_of(state: &AppState) -> Result<account::api::Api, Error> {
    let account = state.account()?;
    Ok(account.as_ref().ok_or(SyncError::NotSignedIn)?.api()?)
}
