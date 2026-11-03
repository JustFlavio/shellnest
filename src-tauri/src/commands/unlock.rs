use super::account::KEYCHAIN_ENTRY;
use crate::{
    account::{self, OpenAccount},
    error::Error,
    keychain,
    state::AppState,
    sync::SyncError,
    vault::{self, Disk, OpenVault, VaultError},
    view::{View, view},
};
use tauri::{Manager, State};

#[tauri::command(async)]
pub(crate) fn status(state: State<AppState>) -> Result<View, Error> {
    view(&state)
}
#[tauri::command]
pub(crate) async fn unlock(
    app: tauri::AppHandle,
    vault_id: String,
    password: String,
    create: bool,
) -> Result<View, Error> {
    let password = zeroize::Zeroizing::new(password);
    tauri::async_runtime::spawn_blocking(move || {
        open_selected(
            &app.state::<AppState>(),
            &vault_id,
            Secret::Password(&password),
            create,
        )
    })
    .await
    .map_err(Error::from)?
}
pub(crate) enum Secret<'a> {
    Password(&'a str),
    // For a local vault its key, for a server vault the account key.
    Key(zeroize::Zeroizing<[u8; 32]>),
    // A server vault opened with the account already open.
    Account,
}
impl std::fmt::Debug for Secret<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let kind = match self {
            Self::Password(_) => "Password",
            Self::Key(_) => "Key",
            Self::Account => "Account",
        };
        f.debug_tuple(kind).field(&crate::model::Redacted).finish()
    }
}
#[tauri::command]
pub(crate) async fn unlock_saved(app: tauri::AppHandle, vault_id: String) -> Result<View, Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let server = on_server(&state, &vault_id)?;
        if server && state.account()?.is_some() {
            return open_selected(&state, &vault_id, Secret::Account, false);
        }
        let entry = if server {
            KEYCHAIN_ENTRY
        } else {
            vault_id.as_str()
        };
        let key = keychain::load(entry)?;
        let opened = open_selected(&state, &vault_id, Secret::Key(key), false);
        // A key that no longer opens the vault is useless: ask for the password again.
        if opened.is_err() {
            keychain::forget(entry);
        }
        opened
    })
    .await
    .map_err(Error::from)?
}
/// A server vault opens with the account password, the same for all of the account's vaults.
pub(crate) fn on_server(state: &AppState, vault_id: &str) -> Result<bool, Error> {
    Ok(state
        .catalog()?
        .vaults
        .iter()
        .any(|e| e.id == vault_id && e.remote.is_some()))
}
#[tauri::command(async)]
pub(crate) fn is_remembered(state: State<AppState>, vault_id: String) -> Result<bool, Error> {
    if on_server(&state, &vault_id)? {
        return Ok(state.account()?.is_some() || keychain::load(KEYCHAIN_ENTRY).is_ok());
    }
    Ok(keychain::load(&vault_id).is_ok())
}
#[tauri::command(async)]
pub(crate) fn set_remembered(
    state: State<AppState>,
    vault_id: String,
    enabled: bool,
) -> Result<(), Error> {
    let server = on_server(&state, &vault_id)?;
    let entry = if server {
        KEYCHAIN_ENTRY
    } else {
        vault_id.as_str()
    };
    if !enabled {
        keychain::forget(entry);
        return Ok(());
    }
    if server {
        let account = state.account()?;
        let account = account.as_ref().ok_or(SyncError::NotSignedIn)?;
        return Ok(keychain::save(entry, &account.key)?);
    }
    let guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_ref().ok_or(Error::VaultLocked)?;
    Ok(keychain::save(entry, &v.key)?)
}
pub(crate) fn open_selected(
    s: &AppState,
    vault_id: &str,
    secret: Secret,
    create: bool,
) -> Result<View, Error> {
    let mut guard = s.vault()?;
    s.ensure_vault(vault_id)?;
    let path = s.active_path()?;
    if guard.is_some() {
        return Err(VaultError::AlreadyOpen.into());
    }
    if on_server(s, vault_id)? {
        if create {
            return Err(VaultError::AlreadyExists.into());
        }
        let raw = std::fs::read(&path).map_err(VaultError::from)?;
        let disk: Disk = serde_json::from_slice(&raw).map_err(|_| VaultError::Invalid)?;
        let key = open_account(s, secret)?;
        *guard = Some(OpenVault::open_remote(&key, disk)?);
        drop(guard);
        return view(s);
    }
    if matches!(secret, Secret::Account) {
        return Err(VaultError::PasswordRequired.into());
    }
    let v = if create {
        if path.exists() {
            return Err(VaultError::AlreadyExists.into());
        }
        let Secret::Password(password) = secret else {
            return Err(VaultError::PasswordRequired.into());
        };
        let v = OpenVault::create(password)?;
        vault::save(&path, &v.disk)?;
        v
    } else {
        let raw = std::fs::read(&path).map_err(VaultError::from)?;
        let disk: Disk = serde_json::from_slice(&raw).map_err(|_| VaultError::Invalid)?;
        let mut v = match secret {
            Secret::Password(password) => OpenVault::unlock(password, disk)?,
            Secret::Key(key) => OpenVault::unlock_with_key(key, disk)?,
            Secret::Account => return Err(VaultError::PasswordRequired.into()),
        };
        if v.data.migrated {
            let backup = path.with_extension("pre-v6.bak");
            if !backup.exists() {
                std::fs::copy(&path, backup).map_err(VaultError::from)?;
            }
            v.seal()?;
            vault::save(&path, &v.disk)?;
        }
        v
    };
    *guard = Some(v);
    drop(guard);
    view(s)
}
// Opens the account (if needed) and returns its key. The password opens the file again even when
// the account is open, so a wrong one is never accepted.
fn open_account(s: &AppState, secret: Secret) -> Result<zeroize::Zeroizing<[u8; 32]>, Error> {
    let mut account = s.account()?;
    if let (Secret::Account, Some(open)) = (&secret, account.as_ref()) {
        return Ok(open.key.clone());
    }
    let file = account::load(&s.path)?.ok_or(SyncError::NotSignedIn)?;
    let opened = match secret {
        Secret::Password(password) => match OpenAccount::unlock(file.clone(), password) {
            Err(SyncError::WrongPassword) => {
                let opened = OpenAccount::unlock_changed(file, password)?;
                account::save(&s.path, &opened.file)?;
                opened
            }
            opened => opened?,
        },
        Secret::Key(key) => OpenAccount::unlock_with_key(file, key)?,
        Secret::Account => return Err(Error::VaultLocked),
    };
    let key = opened.key.clone();
    *account = Some(opened);
    Ok(key)
}
#[tauri::command(async)]
pub(crate) fn lock(state: State<AppState>, vault_id: String) -> Result<View, Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    state.close_sessions();
    *guard = None;
    // Locking locks the account too: its other vaults need the password again.
    *state.account()? = None;
    drop(guard);
    view(&state)
}
