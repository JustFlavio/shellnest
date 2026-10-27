use crate::{
    error::Error,
    keychain,
    state::AppState,
    vault::{self, Disk, OpenVault, VaultError},
    view::{view, View},
};
use tauri::{Manager, State};

#[tauri::command]
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
    Key(zeroize::Zeroizing<[u8; 32]>),
}
#[tauri::command]
pub(crate) async fn unlock_saved(app: tauri::AppHandle, vault_id: String) -> Result<View, Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let key = keychain::load(&vault_id)?;
        let opened = open_selected(&app.state::<AppState>(), &vault_id, Secret::Key(key), false);
        // A key that no longer opens the vault is useless: ask for the password again.
        if opened.is_err() {
            keychain::forget(&vault_id);
        }
        opened
    })
    .await
    .map_err(Error::from)?
}
#[tauri::command]
pub(crate) fn is_remembered(vault_id: String) -> bool {
    keychain::load(&vault_id).is_ok()
}
#[tauri::command]
pub(crate) fn set_remembered(
    state: State<AppState>,
    vault_id: String,
    enabled: bool,
) -> Result<(), Error> {
    if !enabled {
        keychain::forget(&vault_id);
        return Ok(());
    }
    let guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_ref().ok_or(Error::VaultLocked)?;
    Ok(keychain::save(&vault_id, &v.key)?)
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
        };
        if v.data.migrated {
            let backup = path.with_extension("pre-v4.bak");
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
#[tauri::command]
pub(crate) fn lock(state: State<AppState>, vault_id: String) -> Result<View, Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    state.close_sessions();
    *guard = None;
    drop(guard);
    view(&state)
}
