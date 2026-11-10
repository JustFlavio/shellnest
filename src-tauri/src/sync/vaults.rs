//! Server vaults as a whole: publishing a local vault, receiving the account's vaults on a new
//! device, leaving or deleting one, renaming it for every member.
use super::{Meta, Session, SyncError};
use crate::{
    account::{
        api::Role,
        crypto::{open_sealed, random, seal_to, wrap_key},
    },
    error::Error,
    model,
    model::{Data, shared},
    state::AppState,
    terminal,
    vault::{
        self, Disk, OpenVault, VaultCatalog, VaultEntry, VaultError,
        remote::{
            Remote, RemoteDisk, as_envelope, key_aad, meta_aad, open_private, private_aad,
            private_key, private_wire_aad, seal_part, team_wire_aad,
        },
    },
    view::{View, view},
};

/// Creates the vault on the server from `data`: hosts and folders become the team part, the rest
/// this member's private part. Returns the open vault to save under the local id.
fn publish(s: &Session, id: &str, name: &str, data: &Data) -> Result<OpenVault, Error> {
    let key = random::<32>()?;
    let (team, private) = shared::separate(data);
    // A new vault starts at revision 1, its private part too.
    let team_box = seal_part(&key, &team, &team_wire_aad(id, 1))?;
    let reply = s.api.create_vault(
        id,
        &seal_part(&key, &Meta { name: name.into() }, &meta_aad(id))?,
        &seal_to(&s.public, &key, &key_aad(id))?,
        &team_box,
    )?;
    let private_key = private_key(&s.key, id);
    if reply.revision != 1 {
        return Err(SyncError::RemoteInvalid.into());
    }
    let private_box = seal_part(&private_key, &private, &private_wire_aad(id, 1))?;
    let private_revision = s.api.put_private(id, 0, &private_box)?;
    if private_revision != 1 {
        return Err(SyncError::RemoteInvalid.into());
    }
    let disk = Disk {
        envelope: as_envelope(team_box.clone()),
        dirty: false,
        remote: Some(RemoteDisk {
            id: id.into(),
            role: Role::Owner,
            members: 1,
            key: wrap_key(&s.key, &key, &key_aad(id))?,
            key_epoch: reply.key_epoch,
            revision: reply.revision,
            base: team_box,
            private: private_box.clone(),
            private_revision,
            private_base: Some(private_box),
            private_dirty: false,
        }),
    };
    Ok(OpenVault::from_parts(
        key,
        Remote {
            team,
            private,
            private_key,
        },
        disk,
    )?)
}

/// Puts the open local vault on the server. Its file is kept as `.pre-server.bak` first.
pub(crate) fn upload(state: &AppState, vault_id: &str) -> Result<View, Error> {
    let session = Session::of(state)?;
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let path = state.active_path()?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    if v.remote.is_some() {
        return Err(SyncError::AlreadyOnServer.into());
    }
    let mut catalog = state.catalog()?;
    let entry = catalog
        .vaults
        .iter()
        .find(|e| e.id == vault_id)
        .ok_or(Error::VaultNotFound)?;
    let remote_id = model::new_id();
    let candidate = publish(&session, &remote_id, &entry.name, &v.data)?;
    let backup = path.with_extension("pre-server.bak");
    if !backup.exists() {
        std::fs::copy(&path, backup).map_err(VaultError::from)?;
    }
    vault::save(&path, &candidate.disk)?;
    let mut next = catalog.clone();
    if let Some(entry) = next.vaults.iter_mut().find(|e| e.id == vault_id) {
        entry.remote = Some(remote_id);
    }
    next.persist(&state.path)?;
    *catalog = next;
    *v = candidate;
    drop(catalog);
    drop(guard);
    view(state)
}

/// A new empty vault on the server, selected and open.
pub(crate) fn create(state: &AppState, expected: &str, name: &str) -> Result<View, Error> {
    let session = Session::of(state)?;
    let mut guard = state.vault()?;
    state.ensure_vault(expected)?;
    let mut catalog = state.catalog()?;
    let name = catalog.validate_name(name, None)?;
    let id = model::new_id();
    let candidate = publish(&session, &id, &name, &Data::default())?;
    vault::save(&VaultCatalog::path_for(&state.path, &id)?, &candidate.disk)?;
    let mut next = catalog.clone();
    next.vaults.push(VaultEntry {
        id: id.clone(),
        name,
        remote: Some(id.clone()),
    });
    next.selected = id;
    next.persist(&state.path)?;
    state.close_sessions();
    *catalog = next;
    *guard = Some(candidate);
    drop(catalog);
    drop(guard);
    view(state)
}

/// Adds the account's vaults this device does not have yet, with their contents.
pub(crate) fn receive(state: &AppState) -> Result<(), Error> {
    let session = Session::of(state)?;
    let known: Vec<String> = state
        .catalog()?
        .vaults
        .iter()
        .filter_map(|e| e.remote.clone())
        .collect();
    let mut added: Vec<(String, String)> = vec![];
    for listed in session.api.vaults()? {
        if known.contains(&listed.id) || !vault::valid_vault_id(&listed.id) {
            continue;
        }
        let id = listed.id.clone();
        let key = open_sealed(&session.secret, &listed.sealed_key, &key_aad(&id))?;
        let reply = session.api.vault(&id)?;
        let envelope = reply.envelope.ok_or(SyncError::RemoteInvalid)?;
        let team = vault::remote::open_team(&key, &envelope, &team_wire_aad(&id, reply.revision))?;
        let private_key = private_key(&session.key, &id);
        let stored = session.api.private(&id)?;
        let private = match &stored {
            Some(s) => open_private(
                &private_key,
                &s.envelope,
                &private_wire_aad(&id, s.revision),
            )?,
            None => shared::Private::default(),
        };
        let name = vault::remote::open_part::<Meta>(&key, &reply.meta, &meta_aad(&id))
            .map(|m| m.name)
            .unwrap_or_else(|_| id.clone());
        let disk = Disk {
            envelope: as_envelope(envelope.clone()),
            dirty: false,
            remote: Some(RemoteDisk {
                id: id.clone(),
                role: reply.role,
                members: reply.members,
                key: wrap_key(&session.key, &key, &key_aad(&id))?,
                key_epoch: reply.key_epoch,
                revision: reply.revision,
                base: envelope,
                private: seal_part(&private_key, &private, &private_aad(&id))?,
                private_revision: stored.as_ref().map_or(0, |s| s.revision),
                private_base: stored.map(|s| s.envelope),
                private_dirty: false,
            }),
        };
        let vault = OpenVault::from_parts(
            key,
            Remote {
                team,
                private,
                private_key,
            },
            disk,
        )?;
        vault::save(&VaultCatalog::path_for(&state.path, &id)?, &vault.disk)?;
        added.push((id, name));
    }
    if added.is_empty() {
        return Ok(());
    }
    let mut catalog = state.catalog()?;
    let mut next = catalog.clone();
    for (id, name) in added {
        let name = free_name(&next, &name, &id);
        next.vaults.push(VaultEntry {
            id: id.clone(),
            name,
            remote: Some(id),
        });
    }
    next.persist(&state.path)?;
    *catalog = next;
    Ok(())
}

// Vault names are unique on this device; a received one that clashes gets a number.
fn free_name(catalog: &VaultCatalog, name: &str, id: &str) -> String {
    (1..)
        .map(|n| {
            if n == 1 {
                name.to_owned()
            } else {
                format!("{name} {n}")
            }
        })
        .find(|candidate| catalog.validate_name(candidate, Some(id)).is_ok())
        .unwrap_or_else(|| id.to_owned())
}

/// Takes the name the vault has on the server.
pub(crate) fn rename_entry(state: &AppState, local_id: &str, name: &str) -> Result<(), Error> {
    let mut catalog = state.catalog()?;
    if catalog
        .vaults
        .iter()
        .any(|v| v.id == local_id && v.name == name)
    {
        return Ok(());
    }
    let name = free_name(&catalog, name, local_id);
    let mut next = catalog.clone();
    if let Some(entry) = next.vaults.iter_mut().find(|v| v.id == local_id) {
        entry.name = name;
    }
    next.persist(&state.path)?;
    *catalog = next;
    Ok(())
}

/// Renames the open server vault for every member. Only an owner may.
pub(crate) fn rename(state: &AppState, vault_id: &str, name: &str) -> Result<(), Error> {
    let session = Session::of(state)?;
    let guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_ref().ok_or(Error::VaultLocked)?;
    let disk = v.disk.remote.as_ref().ok_or(SyncError::NotOnServer)?;
    if disk.role != Role::Owner {
        return Err(SyncError::NotAllowed.into());
    }
    let meta = seal_part(&v.key, &Meta { name: name.into() }, &meta_aad(&disk.id))?;
    session.api.put_meta(&disk.id, disk.key_epoch, &meta)?;
    Ok(())
}

/// Leaves the selected server vault, or deletes it when its owner is its only member, and removes
/// it from this device.
pub(crate) fn leave(state: &AppState, vault_id: &str) -> Result<View, Error> {
    let session = Session::of(state)?;
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let path = state.active_path()?;
    let disk: Disk = serde_json::from_slice(&std::fs::read(&path).map_err(VaultError::from)?)
        .map_err(|_| VaultError::Invalid)?;
    let remote = disk.remote.ok_or(SyncError::NotOnServer)?;
    if remote.role == Role::Owner && remote.members <= 1 {
        // Deleting removes the only copy on the server: as with a local vault, only when empty.
        let v = guard.as_ref().ok_or(VaultError::LockedForDeletion)?;
        let d = &v.data;
        if !(d.hosts.is_empty()
            && d.identities.is_empty()
            && d.keys.is_empty()
            && d.groups.is_empty()
            && d.workspaces.is_empty())
        {
            return Err(VaultError::NotEmpty.into());
        }
        session.api.delete_vault(&remote.id)?;
    } else {
        match session.api.leave(&remote.id) {
            // Already removed by the owner: only the local copy is left.
            Ok(()) | Err(SyncError::NotFound) => {}
            Err(e) => return Err(e.into()),
        }
    }
    let mut catalog = state.catalog()?;
    let mut next = catalog.clone();
    next.vaults.retain(|v| v.id != vault_id);
    if vault_id == "personal" {
        next.vaults
            .insert(0, VaultCatalog::default().vaults.remove(0));
    }
    next.selected = "personal".into();
    let mut sessions = state.sessions();
    next.persist(&state.path)?;
    crate::sftp::close_all(state);
    for (_, tx) in sessions.drain() {
        let _ = tx.send(terminal::Input::Close);
    }
    *catalog = next;
    *guard = None;
    drop(sessions);
    drop(catalog);
    drop(guard);
    remove_files(&path);
    view(state)
}

pub(crate) fn remove_files(path: &std::path::Path) {
    for file in [path.with_extension("bak"), path.to_path_buf()] {
        let _ = std::fs::remove_file(file);
    }
}
