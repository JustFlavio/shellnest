//! The shared app state (open vault, catalog, sessions) and the one way to persist a change.
use crate::{
    error::Error,
    locks::MutexExt,
    model, terminal,
    vault::{self, OpenVault, VaultError},
};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};
use tokio::sync::mpsc::UnboundedSender;

pub(crate) struct AppState {
    pub(crate) path: PathBuf,
    pub(crate) catalog: Mutex<vault::VaultCatalog>,
    pub(crate) vault: Mutex<Option<OpenVault>>,
    pub(crate) sftp: crate::sftp::Registry,
    pub(crate) sessions: Mutex<HashMap<String, UnboundedSender<terminal::Input>>>,
}
impl AppState {
    pub(crate) fn new(path: PathBuf) -> Result<Self, VaultError> {
        let catalog = vault::VaultCatalog::load(&path)?;
        Ok(Self {
            path,
            catalog: Mutex::new(catalog),
            vault: Mutex::new(None),
            sessions: Mutex::new(HashMap::new()),
            sftp: Mutex::new(HashMap::new()),
        })
    }
    /// The open vault. A poisoned lock is an error: after a panic its contents are not vouched for.
    pub(crate) fn vault(&self) -> Result<MutexGuard<'_, Option<OpenVault>>, Error> {
        self.vault.lock().map_err(|_| Error::StatePoisoned)
    }
    pub(crate) fn catalog(&self) -> Result<MutexGuard<'_, vault::VaultCatalog>, Error> {
        self.catalog.lock().map_err(|_| Error::CatalogPoisoned)
    }
    /// The open sessions are a plain registry, so it stays usable after a panic (see `locks`).
    pub(crate) fn sessions(
        &self,
    ) -> MutexGuard<'_, HashMap<String, UnboundedSender<terminal::Input>>> {
        self.sessions.lock_recovering()
    }
    // The vault mutex owns selection changes; callers hold it before checking scope or resolving paths.
    pub(crate) fn ensure_vault(&self, id: &str) -> Result<(), Error> {
        if self.catalog()?.selected != id {
            return Err(Error::VaultSwitched);
        }
        Ok(())
    }
    pub(crate) fn active_path(&self) -> Result<PathBuf, Error> {
        Ok(self.catalog()?.selected_path(&self.path)?)
    }
    pub(crate) fn host_password(&self, vault_id: &str, id: &str) -> Result<String, Error> {
        let guard = self.vault()?;
        self.ensure_vault(vault_id)?;
        let vault = guard.as_ref().ok_or(Error::VaultLocked)?;
        let host = vault
            .data
            .hosts
            .iter()
            .find(|h| h.id == id)
            .ok_or(model::ModelError::HostNotFound)?;
        let credentials = host
            .credentials
            .as_ref()
            .filter(|_| host.identity_id.is_empty())
            .ok_or(Error::NoPrivatePassword)?;
        Ok(credentials.password.clone())
    }
    pub(crate) fn close_sessions(&self) {
        crate::sftp::close_all(self);
        for (_, tx) in self.sessions().drain() {
            let _ = tx.send(terminal::Input::Close);
        }
    }
}
// Persist a candidate before replacing the in-memory data, so write failures do not lose edits.
pub(crate) fn commit(s: &AppState, v: &mut OpenVault, data: model::Data) -> Result<(), Error> {
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
pub(crate) fn record_connection(
    state: &AppState,
    vault_id: &str,
    host_id: &str,
    expected_address: &str,
    expected_port: u16,
    os: Option<String>,
    now_ms: u64,
) -> Result<(), Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        commands::{
            mutate,
            unlock::{Secret, open_selected},
        },
        model::{Host, Identity},
        test_support::VaultFixture,
    };
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
                tags: vec![],
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
}
