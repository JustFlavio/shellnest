use crate::{
    error::Error,
    keychain, model,
    state::AppState,
    terminal,
    vault::{self, VaultError},
    view::{View, view},
};
use tauri::State;

#[tauri::command(async)]
pub(crate) fn select_vault(state: State<AppState>, vault_id: String) -> Result<View, Error> {
    select(&state, &vault_id)
}
fn select(state: &AppState, id: &str) -> Result<View, Error> {
    let mut guard = state.vault()?;
    let mut catalog = state.catalog()?;
    if !catalog.vaults.iter().any(|v| v.id == id) {
        return Err(Error::VaultNotFound);
    }
    if catalog.selected != id {
        let mut next = catalog.clone();
        next.selected = id.into();
        let mut sessions = state.sessions();
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
#[tauri::command(async)]
pub(crate) fn create_vault(
    state: State<AppState>,
    vault_id: String,
    name: String,
) -> Result<View, Error> {
    create(&state, &vault_id, &name)
}
fn create(state: &AppState, expected: &str, name: &str) -> Result<View, Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(expected)?;
    let mut catalog = state.catalog()?;
    let name = catalog.validate_name(name, None)?;
    let mut next = catalog.clone();
    let id = model::new_id();
    next.vaults.push(vault::VaultEntry {
        id: id.clone(),
        name,
    });
    next.selected = id;
    let mut sessions = state.sessions();
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
#[tauri::command(async)]
pub(crate) fn rename_vault(
    state: State<AppState>,
    vault_id: String,
    name: String,
) -> Result<View, Error> {
    let guard = state.vault()?;
    state.ensure_vault(&vault_id)?;
    let mut catalog = state.catalog()?;
    let name = catalog.validate_name(&name, Some(&vault_id))?;
    let mut next = catalog.clone();
    next.vaults
        .iter_mut()
        .find(|v| v.id == vault_id)
        .ok_or(Error::VaultNotFound)?
        .name = name;
    next.persist(&state.path)?;
    *catalog = next;
    drop(catalog);
    drop(guard);
    view(&state)
}
#[tauri::command(async)]
pub(crate) fn delete_vault(state: State<AppState>, vault_id: String) -> Result<View, Error> {
    delete(&state, &vault_id)
}
// Only the active vault, only when empty (or never created on disk), never the default one.
fn delete(state: &AppState, id: &str) -> Result<View, Error> {
    if id == "personal" {
        return Err(VaultError::DefaultNotDeletable.into());
    }
    let mut guard = state.vault()?;
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
                return Err(VaultError::NotEmpty.into());
            }
        }
        None if path.exists() => return Err(VaultError::LockedForDeletion.into()),
        None => {}
    }
    let mut catalog = state.catalog()?;
    let mut next = catalog.clone();
    next.vaults.retain(|v| v.id != id);
    next.selected = "personal".into();
    let mut sessions = state.sessions();
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        commands::{
            mutate,
            unlock::{Secret, open_selected},
        },
        model::Identity,
        test_support::VaultFixture,
    };
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
        assert!(
            open_selected(
                &state,
                "personal",
                Secret::Password("personal test password"),
                false
            )
            .is_err()
        );
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
        assert!(
            open_selected(
                &state,
                "personal",
                Secret::Password("work test password"),
                false
            )
            .is_err()
        );
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
}
