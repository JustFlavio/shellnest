mod local;
mod model;
mod sync;
mod terminal;
mod vault;
use model::{Host, HostCredentials, Identity, SshKey};
use serde::Serialize;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{Manager, State};
use tokio::sync::mpsc::UnboundedSender;
use vault::{Disk, OpenVault};

pub struct AppState {
    pub path: PathBuf,
    pub catalog: Mutex<vault::VaultCatalog>,
    pub vault: Mutex<Option<OpenVault>>,
    pub sessions: Mutex<HashMap<String, UnboundedSender<terminal::Input>>>,
}
impl AppState {
    pub fn new(path: PathBuf) -> Result<Self, String> {
        let catalog = vault::VaultCatalog::load(&path)?;
        Ok(Self {
            path,
            catalog: Mutex::new(catalog),
            vault: Mutex::new(None),
            sessions: Mutex::new(HashMap::new()),
        })
    }
    // The vault mutex owns selection changes; callers hold it before checking scope or resolving paths.
    pub fn ensure_vault(&self, id: &str) -> Result<(), String> {
        if self
            .catalog
            .lock()
            .map_err(|_| "Registro vault non disponibile")?
            .selected
            != id
        {
            return Err(
                "Il vault attivo è cambiato. Ripeti l’operazione nel vault corretto.".into(),
            );
        }
        Ok(())
    }
    pub fn active_path(&self) -> Result<PathBuf, String> {
        self.catalog
            .lock()
            .map_err(|_| "Registro vault non disponibile")?
            .selected_path(&self.path)
    }
    fn host_password(&self, vault_id: &str, id: &str) -> Result<String, String> {
        let guard = self.vault.lock().map_err(|_| "Stato non disponibile")?;
        self.ensure_vault(vault_id)?;
        let vault = guard.as_ref().ok_or("Vault bloccato")?;
        let host = vault
            .data
            .hosts
            .iter()
            .find(|h| h.id == id)
            .ok_or("Host non trovato")?;
        let credentials = host
            .credentials
            .as_ref()
            .filter(|_| host.identity_id.is_empty())
            .ok_or("Questo host non ha una password privata salvata")?;
        Ok(credentials.password.clone())
    }
    fn close_sessions(&self) -> Result<(), String> {
        for (_, tx) in self
            .sessions
            .lock()
            .map_err(|_| "Sessioni non disponibili")?
            .drain()
        {
            let _ = tx.send(terminal::Input::Close);
        }
        Ok(())
    }
}
#[derive(Serialize)]
struct VaultView {
    id: String,
    name: String,
    exists: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HostView {
    id: String,
    name: String,
    address: String,
    // Effective port; own_port is None when it comes from a group (or the 22 default).
    port: u16,
    own_port: Option<u16>,
    group_id: String,
    identity_id: String,
    effective_identity_id: String,
    // The group an inherited identity comes from; empty when the host has its own.
    identity_source: String,
    username: Option<String>,
    has_password: bool,
    fingerprint: String,
    os: Option<String>,
    last_connected_at: Option<u64>,
}
impl HostView {
    fn new(h: &Host, data: &model::Data) -> Self {
        Self {
            id: h.id.clone(),
            name: h.name.clone(),
            address: h.address.clone(),
            port: data.effective_port(h),
            own_port: h.port,
            group_id: h.group_id.clone(),
            identity_id: h.identity_id.clone(),
            effective_identity_id: data.effective_identity_id(h),
            identity_source: data
                .inherited_identity(h)
                .map(|g| g.id.clone())
                .unwrap_or_default(),
            username: h.credentials.as_ref().map(|c| c.username.clone()),
            has_password: h
                .credentials
                .as_ref()
                .is_some_and(|c| !c.password.is_empty()),
            fingerprint: h.fingerprint.clone(),
            os: h.os.clone(),
            last_connected_at: h.last_connected_at,
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IdentityView {
    id: String,
    name: String,
    username: String,
    auth: String,
    key_id: String,
    has_password: bool,
    host_count: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct KeyView {
    id: String,
    name: String,
    fingerprint: String,
    identity_count: usize,
    host_count: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct View {
    vault_id: String,
    vault_name: String,
    vaults: Vec<VaultView>,
    exists: bool,
    unlocked: bool,
    hosts: Vec<HostView>,
    identities: Vec<IdentityView>,
    keys: Vec<KeyView>,
    groups: Vec<model::Group>,
    workspaces: Vec<model::Workspace>,
    sync_url: String,
    sync_configured: bool,
    dirty: bool,
}
fn view(s: &AppState) -> Result<View, String> {
    let guard = s.vault.lock().map_err(|_| "Stato non disponibile")?;
    let catalog = s
        .catalog
        .lock()
        .map_err(|_| "Registro vault non disponibile")?;
    let selected = catalog
        .vaults
        .iter()
        .find(|v| v.id == catalog.selected)
        .ok_or("Vault non trovato")?;
    let vaults = || -> Vec<VaultView> {
        catalog
            .vaults
            .iter()
            .map(|entry| VaultView {
                id: entry.id.clone(),
                name: entry.name.clone(),
                exists: vault::VaultCatalog::path_for(&s.path, &entry.id).is_ok_and(|p| p.exists()),
            })
            .collect()
    };
    Ok(match guard.as_ref() {
        Some(v) => View {
            vault_id: selected.id.clone(),
            vault_name: selected.name.clone(),
            vaults: vaults(),
            exists: true,
            unlocked: true,
            hosts: v
                .data
                .hosts
                .iter()
                .map(|h| HostView::new(h, &v.data))
                .collect(),
            groups: v.data.groups.clone(),
            identities: v
                .data
                .identities
                .iter()
                .map(|i| IdentityView {
                    id: i.id.clone(),
                    name: i.name.clone(),
                    username: i.username.clone(),
                    auth: i.auth.clone(),
                    key_id: i.key_id.clone(),
                    has_password: !i.password.is_empty(),
                    host_count: v
                        .data
                        .hosts
                        .iter()
                        .filter(|h| h.identity_id == i.id)
                        .count(),
                })
                .collect(),
            keys: v
                .data
                .keys
                .iter()
                .map(|k| KeyView {
                    id: k.id.clone(),
                    name: k.name.clone(),
                    fingerprint: k.fingerprint.clone(),
                    identity_count: v
                        .data
                        .identities
                        .iter()
                        .filter(|i| i.key_id == k.id)
                        .count(),
                    host_count: v
                        .data
                        .hosts
                        .iter()
                        .filter(|h| {
                            v.data
                                .identities
                                .iter()
                                .any(|i| i.id == h.identity_id && i.key_id == k.id)
                        })
                        .count(),
                })
                .collect(),
            workspaces: v.data.workspaces.clone(),
            sync_url: v.data.sync_url.clone(),
            sync_configured: !v.data.sync_token.is_empty(),
            dirty: v.disk.dirty,
        },
        None => View {
            vault_id: selected.id.clone(),
            vault_name: selected.name.clone(),
            vaults: vaults(),
            exists: catalog.selected_path(&s.path)?.exists(),
            unlocked: false,
            hosts: vec![],
            identities: vec![],
            keys: vec![],
            groups: vec![],
            workspaces: vec![],
            sync_url: String::new(),
            sync_configured: false,
            dirty: false,
        },
    })
}
// Opens a link clicked in the terminal with the system handler. Only plain http(s) URLs
// are accepted, and the URL is passed as a single argument (no shell involved).
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://"))
        || url.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return Err("Indirizzo non valido".into());
    }
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("rundll32");
        c.arg("url.dll,FileProtocolHandler");
        c
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(&url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn status(state: State<AppState>) -> Result<View, String> {
    view(&state)
}
#[tauri::command]
async fn unlock(
    app: tauri::AppHandle,
    vault_id: String,
    password: String,
    create: bool,
) -> Result<View, String> {
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
    .map_err(|e| e.to_string())?
}
enum Secret<'a> {
    Password(&'a str),
    Key(zeroize::Zeroizing<[u8; 32]>),
}
// The vault key lives in the OS keychain (macOS Keychain, Windows Credential Manager), one entry per vault.
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod keychain {
    use base64::{engine::general_purpose::STANDARD as B64, Engine};
    use zeroize::Zeroizing;
    fn entry(id: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new("Shellnest", id).map_err(|e| e.to_string())
    }
    pub fn save(id: &str, key: &[u8; 32]) -> Result<(), String> {
        entry(id)?
            .set_password(&B64.encode(key))
            .map_err(|e| e.to_string())
    }
    pub fn load(id: &str) -> Result<Zeroizing<[u8; 32]>, String> {
        let text = Zeroizing::new(entry(id)?.get_password().map_err(|e| e.to_string())?);
        let bytes = Zeroizing::new(B64.decode(text.as_bytes()).map_err(|e| e.to_string())?);
        let mut key = Zeroizing::new([0; 32]);
        if bytes.len() != 32 {
            return Err("Chiave salvata non valida".into());
        }
        key.copy_from_slice(&bytes);
        Ok(key)
    }
    pub fn forget(id: &str) {
        if let Ok(e) = entry(id) {
            let _ = e.delete_credential();
        }
    }
}
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod keychain {
    use zeroize::Zeroizing;
    const NO: &str = "Portachiavi non disponibile su questo sistema";
    pub fn save(_: &str, _: &[u8; 32]) -> Result<(), String> {
        Err(NO.into())
    }
    pub fn load(_: &str) -> Result<Zeroizing<[u8; 32]>, String> {
        Err(NO.into())
    }
    pub fn forget(_: &str) {}
}
#[tauri::command]
async fn unlock_saved(app: tauri::AppHandle, vault_id: String) -> Result<View, String> {
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
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn is_remembered(vault_id: String) -> bool {
    keychain::load(&vault_id).is_ok()
}
#[tauri::command]
fn set_remembered(state: State<AppState>, vault_id: String, enabled: bool) -> Result<(), String> {
    if !enabled {
        keychain::forget(&vault_id);
        return Ok(());
    }
    let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_ref().ok_or("Vault bloccato")?;
    keychain::save(&vault_id, &v.key)
}
fn open_selected(
    s: &AppState,
    vault_id: &str,
    secret: Secret,
    create: bool,
) -> Result<View, String> {
    let mut guard = s.vault.lock().map_err(|_| "Stato non disponibile")?;
    s.ensure_vault(vault_id)?;
    let path = s.active_path()?;
    if guard.is_some() {
        return Err("Vault già aperto".into());
    }
    let v = if create {
        if path.exists() {
            return Err("Esiste già un vault locale".into());
        }
        let Secret::Password(password) = secret else {
            return Err("Serve la password per creare il vault".into());
        };
        let v = OpenVault::create(password)?;
        vault::save(&path, &v.disk)?;
        v
    } else {
        let raw = std::fs::read(&path).map_err(|e| e.to_string())?;
        let disk: Disk = serde_json::from_slice(&raw).map_err(|_| "Vault non valido")?;
        let mut v = match secret {
            Secret::Password(password) => OpenVault::unlock(password, disk)?,
            Secret::Key(key) => OpenVault::unlock_with_key(key, disk)?,
        };
        if v.data.migrated {
            let backup = path.with_extension("pre-v4.bak");
            if !backup.exists() {
                std::fs::copy(&path, backup).map_err(|e| e.to_string())?;
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
fn lock(state: State<AppState>, vault_id: String) -> Result<View, String> {
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    state.close_sessions()?;
    *guard = None;
    drop(guard);
    view(&state)
}
#[tauri::command]
fn select_vault(state: State<AppState>, vault_id: String) -> Result<View, String> {
    select(&state, &vault_id)
}
fn select(state: &AppState, id: &str) -> Result<View, String> {
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    let mut catalog = state
        .catalog
        .lock()
        .map_err(|_| "Registro vault non disponibile")?;
    if !catalog.vaults.iter().any(|v| v.id == id) {
        return Err("Vault non trovato".into());
    }
    if catalog.selected != id {
        let mut next = catalog.clone();
        next.selected = id.into();
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "Sessioni non disponibili")?;
        next.persist(&state.path)?;
        for (_, tx) in sessions.drain() {
            let _ = tx.send(terminal::Input::Close);
        }
        *catalog = next;
        *guard = None;
    }
    drop(catalog);
    drop(guard);
    view(state)
}
#[tauri::command]
fn create_vault(state: State<AppState>, vault_id: String, name: String) -> Result<View, String> {
    create(&state, &vault_id, &name)
}
fn create(state: &AppState, expected: &str, name: &str) -> Result<View, String> {
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(expected)?;
    let mut catalog = state
        .catalog
        .lock()
        .map_err(|_| "Registro vault non disponibile")?;
    let name = catalog.validate_name(name, None)?;
    let mut next = catalog.clone();
    let id = model::new_id();
    next.vaults.push(vault::VaultEntry {
        id: id.clone(),
        name,
    });
    next.selected = id;
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "Sessioni non disponibili")?;
    next.persist(&state.path)?;
    for (_, tx) in sessions.drain() {
        let _ = tx.send(terminal::Input::Close);
    }
    *catalog = next;
    *guard = None;
    drop(sessions);
    drop(catalog);
    drop(guard);
    view(state)
}
#[tauri::command]
fn rename_vault(state: State<AppState>, vault_id: String, name: String) -> Result<View, String> {
    let guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    let mut catalog = state
        .catalog
        .lock()
        .map_err(|_| "Registro vault non disponibile")?;
    let name = catalog.validate_name(&name, Some(&vault_id))?;
    let mut next = catalog.clone();
    next.vaults
        .iter_mut()
        .find(|v| v.id == vault_id)
        .ok_or("Vault non trovato")?
        .name = name;
    next.persist(&state.path)?;
    *catalog = next;
    drop(catalog);
    drop(guard);
    view(&state)
}
#[tauri::command]
fn delete_vault(state: State<AppState>, vault_id: String) -> Result<View, String> {
    delete(&state, &vault_id)
}
// Only the active vault, only when empty (or never created on disk), never the default one.
fn delete(state: &AppState, id: &str) -> Result<View, String> {
    if id == "personal" {
        return Err("Il vault Personale non può essere eliminato".into());
    }
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(id)?;
    let path = state.active_path()?;
    match guard.as_ref() {
        Some(v) => {
            let d = &v.data;
            if !(d.hosts.is_empty()
                && d.identities.is_empty()
                && d.keys.is_empty()
                && d.groups.is_empty()
                && d.workspaces.is_empty())
            {
                return Err("Il vault non è vuoto: eliminane prima il contenuto".into());
            }
        }
        None if path.exists() => return Err("Sblocca il vault per eliminarlo".into()),
        None => {}
    }
    let mut catalog = state
        .catalog
        .lock()
        .map_err(|_| "Registro vault non disponibile")?;
    let mut next = catalog.clone();
    next.vaults.retain(|v| v.id != id);
    next.selected = "personal".into();
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "Sessioni non disponibili")?;
    next.persist(&state.path)?;
    for (_, tx) in sessions.drain() {
        let _ = tx.send(terminal::Input::Close);
    }
    *catalog = next;
    *guard = None;
    drop(sessions);
    drop(catalog);
    drop(guard);
    // The catalog no longer lists it; a leftover file is harmless.
    let _ = std::fs::remove_file(path);
    keychain::forget(id);
    view(state)
}
// Persist a candidate before replacing the in-memory data, so write failures do not lose edits.
pub fn commit(s: &AppState, v: &mut OpenVault, data: model::Data) -> Result<(), String> {
    data.validate()?;
    let mut candidate = OpenVault {
        key: v.key.clone(),
        data,
        disk: v.disk.clone(),
    };
    candidate.disk.dirty = true;
    candidate.seal()?;
    vault::save(&s.active_path()?, &candidate.disk)?;
    *v = candidate;
    Ok(())
}
#[tauri::command]
fn reveal_host_password(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<String, String> {
    state.host_password(&vault_id, &id)
}
#[tauri::command]
fn save_host(
    state: State<AppState>,
    vault_id: String,
    host: Host,
    credentials: Option<HostCredentials>,
    inherit: Option<bool>,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| {
        data.upsert_host_inheriting(host, credentials, inherit.unwrap_or(false))
    })
}
fn mutate(
    state: &AppState,
    vault_id: &str,
    operation: impl FnOnce(&mut model::Data) -> Result<(), String>,
) -> Result<View, String> {
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_mut().ok_or("Vault bloccato")?;
    let mut data = v.data.clone();
    operation(&mut data)?;
    commit(state, v, data)?;
    drop(guard);
    view(state)
}
#[tauri::command]
fn save_identity(
    state: State<AppState>,
    vault_id: String,
    identity: Identity,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.upsert_identity(identity))
}
#[tauri::command]
fn save_key(state: State<AppState>, vault_id: String, key: SshKey) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.upsert_key(key))
}
#[tauri::command]
fn delete_identity(state: State<AppState>, vault_id: String, id: String) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.delete_identity(&id))
}
#[tauri::command]
fn delete_key(state: State<AppState>, vault_id: String, id: String) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.delete_key(&id))
}
#[tauri::command]
fn assign_identity(
    state: State<AppState>,
    vault_id: String,
    ids: Vec<String>,
    identity_id: String,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| {
        data.assign_identity(&ids, &identity_id)
    })
}
#[tauri::command]
fn delete_host(state: State<AppState>, vault_id: String, id: String) -> Result<View, String> {
    mutate(&state, &vault_id, |data| {
        data.delete_host(&id);
        Ok(())
    })
}
#[tauri::command]
fn save_group(
    state: State<AppState>,
    vault_id: String,
    group: model::Group,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.upsert_group(group))
}
#[tauri::command]
fn delete_group(state: State<AppState>, vault_id: String, id: String) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.delete_group(&id))
}
#[tauri::command]
fn save_workspace(
    state: State<AppState>,
    vault_id: String,
    workspace: model::Workspace,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| data.upsert_workspace(workspace))
}
#[tauri::command]
fn delete_workspace(state: State<AppState>, vault_id: String, id: String) -> Result<View, String> {
    mutate(&state, &vault_id, |data| {
        data.delete_workspace(&id);
        Ok(())
    })
}
#[tauri::command]
fn configure_sync(
    state: State<AppState>,
    vault_id: String,
    url: String,
    token: String,
) -> Result<View, String> {
    sync::endpoint_for_vault(&url, &vault_id)?;
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(&vault_id)?;
    let v = guard.as_mut().ok_or("Vault bloccato")?;
    let mut data = v.data.clone();
    let changed_endpoint = data.sync_url != url.trim_end_matches('/');
    data.sync_url = url.trim_end_matches('/').into();
    if !token.is_empty() {
        data.sync_token = token;
    }
    if data.sync_token.len() < 32 {
        return Err("Il token deve avere almeno 32 caratteri".into());
    }
    let mut candidate = OpenVault {
        key: v.key.clone(),
        data,
        disk: v.disk.clone(),
    };
    if changed_endpoint {
        candidate.disk.revision = None;
    }
    candidate.disk.dirty = true;
    candidate.seal()?;
    vault::save(&state.active_path()?, &candidate.disk)?;
    *v = candidate;
    drop(guard);
    view(&state)
}
pub(crate) fn record_connection(
    state: &AppState,
    vault_id: &str,
    host_id: &str,
    expected_address: &str,
    expected_port: u16,
    os: Option<String>,
    now_ms: u64,
) -> Result<(), String> {
    let mut guard = state.vault.lock().map_err(|_| "Stato non disponibile")?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_mut().ok_or("Vault bloccato")?;
    if !v.data.hosts.iter().any(|host| {
        host.id == host_id
            && host.address == expected_address
            && v.data.effective_port(host) == expected_port
    }) {
        return Ok(());
    }
    let mut data = v.data.clone();
    data.record_connection(host_id, os, now_ms)?;
    commit(state, v, data)
}
fn claim_instance(path: &std::path::Path) -> Result<std::fs::File, String> {
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.try_lock().map_err(|e| {
        format!("Impossibile aprire il vault locale: chiudi le altre istanze di Shellnest. {e}")
    })?;
    Ok(file)
}
/// Moves the data folder of the old identifier to the new one, so existing vaults survive the rename.
// shortcut: skipped when the new folder already exists (nothing is merged), fine while there are no other users.
#[cfg(not(feature = "desktop-e2e"))]
fn migrate_legacy_data_dir(dir: &std::path::Path) {
    let legacy = dir.with_file_name("dev.servermanager.desktop");
    if !dir.exists() && legacy.is_dir() {
        let _ = std::fs::rename(&legacy, dir);
    }
}
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "desktop-e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());
    builder
        .setup(|app| {
            #[cfg(not(feature = "desktop-e2e"))]
            let dir = {
                let dir = app.path().app_data_dir()?;
                migrate_legacy_data_dir(&dir);
                dir
            };
            #[cfg(feature = "desktop-e2e")]
            let dir = {
                let path = PathBuf::from(std::env::var("SHELLNEST_E2E_DATA_DIR")?);
                if !path.is_absolute() || !path.is_dir() {
                    return Err("E2E requires an existing absolute temporary data directory".into());
                }
                path
            };
            // The default macOS menu binds Cmd+W to "Close Window", which would swallow the pane-close shortcut.
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{Menu, PredefinedMenuItem as P, Submenu};
                let h = app.handle();
                let menu = Menu::with_items(
                    h,
                    &[
                        &Submenu::with_items(
                            h,
                            "Shellnest",
                            true,
                            &[
                                &P::about(h, None, None)?,
                                &P::separator(h)?,
                                &P::hide(h, None)?,
                                &P::hide_others(h, None)?,
                                &P::show_all(h, None)?,
                                &P::separator(h)?,
                                &P::quit(h, None)?,
                            ],
                        )?,
                        &Submenu::with_items(
                            h,
                            "Modifica",
                            true,
                            &[
                                &P::undo(h, None)?,
                                &P::redo(h, None)?,
                                &P::separator(h)?,
                                &P::cut(h, None)?,
                                &P::copy(h, None)?,
                                &P::paste(h, None)?,
                                &P::select_all(h, None)?,
                            ],
                        )?,
                        &Submenu::with_items(
                            h,
                            "Finestra",
                            true,
                            &[&P::minimize(h, None)?, &P::maximize(h, None)?],
                        )?,
                    ],
                )?;
                app.set_menu(menu)?;
            }
            std::fs::create_dir_all(&dir)?;
            // Retain the OS file lock for the app lifetime to prevent two processes writing one vault.
            app.manage(claim_instance(&dir.join("instance.lock")).map_err(std::io::Error::other)?);
            app.manage(AppState::new(dir.join("vault.json")).map_err(std::io::Error::other)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            status,
            select_vault,
            create_vault,
            rename_vault,
            delete_vault,
            unlock,
            unlock_saved,
            is_remembered,
            set_remembered,
            lock,
            save_host,
            reveal_host_password,
            save_identity,
            save_key,
            delete_identity,
            delete_key,
            assign_identity,
            delete_host,
            save_group,
            delete_group,
            save_workspace,
            delete_workspace,
            configure_sync,
            sync::sync_vault,
            sync::restore_vault,
            terminal::probe_host,
            terminal::probe_target,
            terminal::trust_host,
            terminal::connect,
            terminal::connect_quick,
            terminal::terminal_password,
            local::connect_local,
            terminal::terminal_input,
            terminal::terminal_resize,
            open_url,
            terminal::disconnect
        ])
        .on_window_event(|_, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                local::shutdown_all();
            }
        })
        .run(tauri::generate_context!())
        .expect("Avvio app fallito");
}

#[cfg(test)]
mod tests {
    use super::*;
    struct VaultFixture {
        root: PathBuf,
    }
    impl VaultFixture {
        fn new() -> Self {
            let root = std::env::temp_dir()
                .join(format!("shellnest-vault-test-{}", rand::random::<u64>()));
            std::fs::create_dir_all(&root).unwrap();
            Self { root }
        }
        fn state(&self) -> AppState {
            AppState::new(self.root.join("vault.json")).unwrap()
        }
    }
    impl Drop for VaultFixture {
        fn drop(&mut self) {
            if self.root.parent() == Some(std::env::temp_dir().as_path())
                && self
                    .root
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("shellnest-vault-test-")
            {
                let _ = std::fs::remove_dir_all(&self.root);
            }
        }
    }
    #[test]
    fn legacy_data_dir_moves_only_when_the_new_one_is_missing() {
        let fixture = VaultFixture::new();
        let legacy = fixture.root.join("dev.servermanager.desktop");
        let dir = fixture.root.join("io.github.justflavio.shellnest");
        std::fs::create_dir_all(&legacy).unwrap();
        std::fs::write(legacy.join("vault.json"), "v").unwrap();
        migrate_legacy_data_dir(&dir);
        assert!(dir.join("vault.json").exists() && !legacy.exists());
        std::fs::create_dir_all(&legacy).unwrap();
        migrate_legacy_data_dir(&dir);
        assert!(legacy.exists());
    }
    #[test]
    fn host_and_new_credentials_commit_together_without_exposing_or_overwriting_secrets() {
        let fixture = VaultFixture::new();
        let state = fixture.state();
        open_selected(
            &state,
            "personal",
            Secret::Password("test-only master password"),
            true,
        )
        .unwrap();
        let host = Host {
            id: "inline-host".into(),
            name: "API".into(),
            address: "192.0.2.20".into(),
            port: Some(22),
            group_id: String::new(),
            identity_id: String::new(),
            credentials: None,
            fingerprint: String::new(),
            os: None,
            last_connected_at: None,
        };
        let credentials = HostCredentials {
            username: " deploy ".into(),
            password: "synthetic-inline-secret".into(),
        };
        let snapshot = mutate(&state, "personal", |data| {
            data.upsert_host_with_credentials(host.clone(), Some(credentials.clone()))
        })
        .unwrap();
        assert_eq!(snapshot.hosts.len(), 1);
        assert!(snapshot.identities.is_empty());
        assert!(snapshot.hosts[0].identity_id.is_empty());
        assert_eq!(snapshot.hosts[0].username.as_deref(), Some("deploy"));
        assert!(snapshot.hosts[0].has_password);
        assert!(!serde_json::to_string(&snapshot)
            .unwrap()
            .contains("synthetic-inline-secret"));
        let before = std::fs::read(&state.path).unwrap();
        assert_eq!(
            state.host_password("personal", "inline-host").unwrap(),
            "synthetic-inline-secret"
        );
        assert!(state.host_password("other-vault", "inline-host").is_err());
        assert!(state.host_password("personal", "missing").is_err());
        assert_eq!(std::fs::read(&state.path).unwrap(), before);
        let mut invalid = host.clone();
        invalid.name.clear();
        assert!(mutate(&state, "personal", |data| {
            data.upsert_host_with_credentials(invalid, Some(credentials.clone()))
        })
        .is_err());
        assert_eq!(std::fs::read(&state.path).unwrap(), before);
        assert!(view(&state).unwrap().identities.is_empty());
        let mut new_host = host.clone();
        new_host.id = "another-host".into();
        assert!(mutate(&state, "personal", |data| {
            data.upsert_host_with_credentials(
                new_host,
                Some(HostCredentials {
                    username: "root".into(),
                    password: String::new(),
                }),
            )
        })
        .is_err());
        assert_eq!(std::fs::read(&state.path).unwrap(), before);
        assert!(mutate(&state, "other-vault", |data| {
            data.upsert_host_with_credentials(host.clone(), Some(credentials.clone()))
        })
        .is_err());
        let second = mutate(&state, "personal", |data| {
            data.upsert_host_with_credentials(
                host,
                Some(HostCredentials {
                    username: "admin".into(),
                    password: "another-synthetic-secret".into(),
                }),
            )
        })
        .unwrap();
        assert!(second.identities.is_empty());
        let guard = state.vault.lock().unwrap();
        let data = &guard.as_ref().unwrap().data;
        assert_eq!(
            data.resolve("inline-host").unwrap().password,
            "another-synthetic-secret"
        );
        drop(guard);
        assert_eq!(
            state.host_password("personal", "inline-host").unwrap(),
            "another-synthetic-secret"
        );
        mutate(&state, "personal", |data| {
            data.upsert_identity(Identity {
                id: "shared-reveal-test".into(),
                name: "Shared".into(),
                username: "root".into(),
                auth: "password".into(),
                key_id: String::new(),
                password: "shared-secret".into(),
            })?;
            data.assign_identity(&["inline-host".into()], "shared-reveal-test")
        })
        .unwrap();
        assert!(state.host_password("personal", "inline-host").is_err());
        *state.vault.lock().unwrap() = None;
        assert!(state.host_password("personal", "inline-host").is_err());
    }
    #[test]
    fn concurrent_app_instances_cannot_write_the_same_vault() {
        let fixture = VaultFixture::new();
        let path = fixture.root.join("instance.lock");
        let first = claim_instance(&path).unwrap();
        assert!(claim_instance(&path).is_err());
        drop(first);
        assert!(claim_instance(&path).is_ok());
    }
    #[test]
    fn delayed_connection_metadata_never_updates_a_changed_endpoint() {
        let fixture = VaultFixture::new();
        let state = fixture.state();
        open_selected(
            &state,
            "personal",
            Secret::Password("test-only master password"),
            true,
        )
        .unwrap();
        mutate(&state, "personal", |data| {
            data.upsert_identity(Identity {
                id: "admin".into(),
                name: "Admin".into(),
                username: "root".into(),
                auth: "password".into(),
                key_id: String::new(),
                password: "synthetic-secret".into(),
            })?;
            data.upsert_host(Host {
                id: "server".into(),
                name: "Server".into(),
                address: "192.0.2.1".into(),
                port: Some(22),
                group_id: String::new(),
                identity_id: "admin".into(),
                credentials: None,
                fingerprint: String::new(),
                os: None,
                last_connected_at: None,
            })
        })
        .unwrap();
        record_connection(
            &state,
            "personal",
            "server",
            "192.0.2.1",
            22,
            Some("ubuntu".into()),
            10,
        )
        .unwrap();
        mutate(&state, "personal", |data| {
            let mut host = data.hosts[0].clone();
            host.port = Some(2222);
            data.upsert_host(host)
        })
        .unwrap();
        let before = std::fs::read(&state.path).unwrap();
        record_connection(
            &state,
            "personal",
            "server",
            "192.0.2.1",
            22,
            Some("debian".into()),
            20,
        )
        .unwrap();
        record_connection(
            &state,
            "personal",
            "missing",
            "192.0.2.1",
            22,
            Some("debian".into()),
            20,
        )
        .unwrap();
        assert_eq!(std::fs::read(&state.path).unwrap(), before);
        {
            let guard = state.vault.lock().unwrap();
            let host = &guard.as_ref().unwrap().data.hosts[0];
            assert_eq!(host.os, None);
            assert_eq!(host.last_connected_at, None);
        }
        record_connection(
            &state,
            "personal",
            "server",
            "192.0.2.1",
            2222,
            Some("debian".into()),
            30,
        )
        .unwrap();
        let guard = state.vault.lock().unwrap();
        let host = &guard.as_ref().unwrap().data.hosts[0];
        assert_eq!(host.os.as_deref(), Some("debian"));
        assert_eq!(host.last_connected_at, Some(30));
    }
    #[test]
    fn multiple_vaults_keep_files_passwords_and_mutations_isolated() {
        let fixture = VaultFixture::new();
        let state = fixture.state();
        open_selected(
            &state,
            "personal",
            Secret::Password("personal test password"),
            true,
        )
        .unwrap();
        mutate(&state, "personal", |data| {
            data.upsert_identity(Identity {
                id: "personal-login".into(),
                name: "Personal".into(),
                username: "root".into(),
                auth: "password".into(),
                key_id: String::new(),
                password: "personal-secret".into(),
            })
        })
        .unwrap();
        let personal_bytes = std::fs::read(&state.path).unwrap();
        assert!(create(&state, "personal", "  PERSONALE ").is_err());
        assert!(state.vault.lock().unwrap().is_some());
        let work = create(&state, "personal", "Lavoro").unwrap();
        assert!(!work.unlocked);
        assert!(!work.exists);
        assert_eq!(work.vaults.len(), 2);
        assert_eq!(std::fs::read(&state.path).unwrap(), personal_bytes);
        assert!(mutate(&state, "personal", |_| Ok(())).is_err());
        assert!(open_selected(
            &state,
            "personal",
            Secret::Password("personal test password"),
            false
        )
        .is_err());
        assert!(open_selected(&state, &work.vault_id, Secret::Password("short"), true).is_err());
        assert!(!state.active_path().unwrap().exists());
        open_selected(
            &state,
            &work.vault_id,
            Secret::Password("work test password"),
            true,
        )
        .unwrap();
        assert!(view(&state).unwrap().identities.is_empty());
        let work_path = state.active_path().unwrap();
        assert_ne!(work_path, state.path);
        select(&state, "personal").unwrap();
        assert!(state.vault.lock().unwrap().is_none());
        assert!(open_selected(
            &state,
            "personal",
            Secret::Password("work test password"),
            false
        )
        .is_err());
        assert_eq!(std::fs::read(&state.path).unwrap(), personal_bytes);
        let personal = open_selected(
            &state,
            "personal",
            Secret::Password("personal test password"),
            false,
        )
        .unwrap();
        assert_eq!(personal.identities.len(), 1);
        assert_eq!(personal.identities[0].id, "personal-login");
        let before = state.catalog.lock().unwrap().selected.clone();
        assert!(select(&state, "../outside").is_err());
        assert_eq!(state.catalog.lock().unwrap().selected, before);
        assert!(state.vault.lock().unwrap().is_some());
        select(&state, &work.vault_id).unwrap();
        let reloaded = fixture.state();
        assert_eq!(view(&reloaded).unwrap().vault_id, work.vault_id);
        assert!(work_path.exists());
        assert_eq!(std::fs::read(&state.path).unwrap(), personal_bytes);
    }
    #[test]
    fn only_empty_non_default_vaults_can_be_deleted() {
        let fixture = VaultFixture::new();
        let state = fixture.state();
        open_selected(
            &state,
            "personal",
            Secret::Password("personal test password"),
            true,
        )
        .unwrap();
        assert!(delete(&state, "personal").is_err());
        let work = create(&state, "personal", "Lavoro").unwrap();
        open_selected(
            &state,
            &work.vault_id,
            Secret::Password("work test password"),
            true,
        )
        .unwrap();
        mutate(&state, &work.vault_id, |data| {
            data.upsert_identity(Identity {
                id: "login".into(),
                name: "Login".into(),
                username: "root".into(),
                auth: "password".into(),
                key_id: String::new(),
                password: "secret".into(),
            })
        })
        .unwrap();
        assert!(delete(&state, &work.vault_id).is_err());
        assert_eq!(view(&state).unwrap().vaults.len(), 2);
        mutate(&state, &work.vault_id, |data| data.delete_identity("login")).unwrap();
        let path = state.active_path().unwrap();
        let after = delete(&state, &work.vault_id).unwrap();
        assert_eq!(after.vault_id, "personal");
        assert_eq!(after.vaults.len(), 1);
        assert!(!path.exists());
        let never_opened = create(&state, "personal", "Vuoto").unwrap();
        assert!(!never_opened.exists);
        assert_eq!(
            delete(&state, &never_opened.vault_id).unwrap().vaults.len(),
            1
        );
    }
    #[test]
    fn switching_closes_sessions_and_catalog_failure_preserves_open_vault() {
        let fixture = VaultFixture::new();
        let state = fixture.state();
        open_selected(
            &state,
            "personal",
            Secret::Password("personal test password"),
            true,
        )
        .unwrap();
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        state
            .sessions
            .lock()
            .unwrap()
            .insert("test-session".into(), tx);
        let work = create(&state, "personal", "Lavoro").unwrap();
        assert!(matches!(rx.try_recv(), Ok(terminal::Input::Close)));
        assert!(state.sessions.lock().unwrap().is_empty());
        open_selected(
            &state,
            &work.vault_id,
            Secret::Password("work test password"),
            true,
        )
        .unwrap();
        let catalog_file = state.path.with_extension("catalog.json");
        std::fs::remove_file(&catalog_file).unwrap();
        std::fs::create_dir(&catalog_file).unwrap();
        assert!(create(&state, &work.vault_id, "Clienti").is_err());
        assert_eq!(state.catalog.lock().unwrap().selected, work.vault_id);
        assert!(state.vault.lock().unwrap().is_some());
        assert!(!vault::valid_vault_id("../secret"));
        assert!(!vault::valid_vault_id("A/B"));
    }
    #[test]
    fn snapshots_hide_secrets_and_invalid_edits_do_not_change_the_vault() {
        let mut v = OpenVault::create("test-only master password").unwrap();
        v.data
            .upsert_identity(Identity {
                id: "login".into(),
                name: "Admin".into(),
                username: "root".into(),
                auth: "password".into(),
                key_id: String::new(),
                password: "synthetic-secret-do-not-expose".into(),
            })
            .unwrap();
        v.data
            .upsert_host(Host {
                id: "server".into(),
                name: "Server".into(),
                address: "192.0.2.1".into(),
                port: Some(22),
                group_id: String::new(),
                identity_id: "login".into(),
                credentials: None,
                fingerprint: String::new(),
                os: None,
                last_connected_at: None,
            })
            .unwrap();
        let state = AppState::new(PathBuf::from("unused-test-path")).unwrap();
        *state.vault.lock().unwrap() = Some(v);
        let snapshot = serde_json::to_value(view(&state).unwrap()).unwrap();
        assert!(!snapshot
            .to_string()
            .contains("synthetic-secret-do-not-expose"));
        assert!(snapshot["hosts"][0].get("password").is_none());
        assert!(snapshot["identities"][0].get("password").is_none());
        assert_eq!(snapshot["identities"][0]["hostCount"], 1);
        assert!(
            mutate(&state, "personal", |data| data.upsert_identity(Identity {
                id: "invalid".into(),
                name: "Invalid".into(),
                username: "root".into(),
                auth: "key".into(),
                key_id: "missing-key".into(),
                password: String::new()
            }))
            .is_err()
        );
        assert_eq!(
            state
                .vault
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .data
                .identities
                .len(),
            1
        );
    }
}
