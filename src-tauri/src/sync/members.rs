//! Who can open a server vault. Adding someone seals the vault key to their public key; removing
//! someone replaces the vault key, since the removed person knows the old one.
use super::{Meta, Session, SyncError, exchange};
use crate::{
    account::{
        api::{MemberReply, Role},
        crypto::{decode32, random, safety_code, seal_to, wrap_key},
    },
    error::Error,
    model::shared,
    state::AppState,
    vault::{
        self, OpenVault,
        remote::{Remote, key_aad, meta_aad, seal_part, team_wire_aad},
    },
    view::{View, view},
};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemberView {
    pub(crate) user_id: String,
    pub(crate) username: String,
    pub(crate) role: Role,
    pub(crate) safety_code: String,
    pub(crate) me: bool,
}
/// After a removal: the members left, and the shared secrets the removed person could read, which
/// should now be changed on the servers themselves.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Removal {
    pub(crate) members: Vec<MemberView>,
    pub(crate) exposed: Vec<String>,
}

fn views(s: &Session, members: Vec<MemberReply>) -> Vec<MemberView> {
    members
        .into_iter()
        .map(|m| MemberView {
            safety_code: decode32(&m.public_key)
                .map(|k| safety_code(&k))
                .unwrap_or_default(),
            me: m.user_id == s.user_id,
            user_id: m.user_id,
            username: m.username,
            role: m.role,
        })
        .collect()
}
fn remote_id(v: &OpenVault) -> Result<String, Error> {
    Ok(v.disk
        .remote
        .as_ref()
        .ok_or(SyncError::NotOnServer)?
        .id
        .clone())
}
fn owner(v: &OpenVault) -> Result<(), Error> {
    if v.role() != Some(Role::Owner) {
        return Err(SyncError::NotAllowed.into());
    }
    Ok(())
}
// Pins the key the first time and refuses a different one later, then saves the pins.
fn checked_key(state: &AppState, user_id: &str, public_key: &str) -> Result<[u8; 32], Error> {
    let mut account = state.account()?;
    let account = account.as_mut().ok_or(SyncError::NotSignedIn)?;
    if account.pin(user_id, public_key)? {
        crate::account::save(&state.path, &account.file)?;
    }
    Ok(decode32(public_key)?)
}

pub(crate) fn members(state: &AppState, vault_id: &str) -> Result<Vec<MemberView>, Error> {
    let session = Session::of(state)?;
    let guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let id = remote_id(guard.as_ref().ok_or(Error::VaultLocked)?)?;
    drop(guard);
    Ok(views(&session, session.api.members(&id)?))
}

/// Adds `username` with `role`, or changes the role of someone already in the vault.
pub(crate) fn add(
    state: &AppState,
    vault_id: &str,
    username: &str,
    role: Role,
) -> Result<Vec<MemberView>, Error> {
    let session = Session::of(state)?;
    let guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_ref().ok_or(Error::VaultLocked)?;
    owner(v)?;
    let id = remote_id(v)?;
    let epoch = v.disk.remote.as_ref().map_or(0, |r| r.key_epoch);
    let user = session.api.user(username.trim())?;
    let public = checked_key(state, &user.id, &user.public_key)?;
    let sealed = seal_to(&public, &v.key, &key_aad(&id))?;
    session
        .api
        .put_member(&id, &user.id, role, Some((epoch, &sealed)))?;
    drop(guard);
    Ok(views(&session, session.api.members(&id)?))
}

pub(crate) fn set_role(
    state: &AppState,
    vault_id: &str,
    user_id: &str,
    role: Role,
) -> Result<Vec<MemberView>, Error> {
    let session = Session::of(state)?;
    let guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let v = guard.as_ref().ok_or(Error::VaultLocked)?;
    owner(v)?;
    let id = remote_id(v)?;
    session.api.put_member(&id, user_id, role, None)?;
    drop(guard);
    Ok(views(&session, session.api.members(&id)?))
}

/// Removes a member: syncs first, then replaces the vault key and seals the new one to everyone
/// left, in one write on the server.
pub(crate) fn remove(state: &AppState, vault_id: &str, user_id: &str) -> Result<Removal, Error> {
    let session = Session::of(state)?;
    if user_id == session.user_id {
        return Err(SyncError::NotAllowed.into());
    }
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let path = state.active_path()?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    owner(v)?;
    let (current, name) = exchange(&session, v)?;
    vault::save(&path, &current.disk)?;
    *v = current;
    let id = remote_id(v)?;
    let disk = v.disk.remote.clone().ok_or(SyncError::NotOnServer)?;
    let remote = v.remote.clone().ok_or(SyncError::NotOnServer)?;
    let members = session.api.members(&id)?;
    if !members.iter().any(|m| m.user_id == user_id) {
        return Err(SyncError::NotFound.into());
    }
    let key = random::<32>()?;
    let mut sealed_keys = serde_json::Map::new();
    for member in members.iter().filter(|m| m.user_id != user_id) {
        let public = if member.user_id == session.user_id {
            session.public
        } else {
            checked_key(state, &member.user_id, &member.public_key)?
        };
        sealed_keys.insert(
            member.user_id.clone(),
            serde_json::to_value(seal_to(&public, &key, &key_aad(&id))?)
                .map_err(|_| SyncError::RemoteInvalid)?,
        );
    }
    let envelope = seal_part(&key, &remote.team, &team_wire_aad(&id, disk.revision + 1))?;
    let name = name.unwrap_or_default();
    let rotated = session.api.rotate(
        &id,
        &serde_json::json!({
            "revision": disk.revision,
            "keyEpoch": disk.key_epoch + 1,
            "envelope": envelope,
            "meta": seal_part(&key, &Meta { name }, &meta_aad(&id))?,
            "remove": [user_id],
            "sealedKeys": sealed_keys,
        }),
    )?;
    let mut next_disk = v.disk.clone();
    if let Some(r) = next_disk.remote.as_mut() {
        r.key = wrap_key(&session.key, &key, &key_aad(&id))?;
        r.key_epoch = rotated.key_epoch;
        if rotated.revision != disk.revision + 1 {
            return Err(SyncError::RemoteInvalid.into());
        }
        r.revision = rotated.revision;
        r.base = envelope;
        r.members = r.members.saturating_sub(1);
    }
    let exposed = remote
        .team
        .identities
        .iter()
        .map(|i| i.name.clone())
        .chain(remote.team.keys.iter().map(|k| k.name.clone()))
        .collect();
    let candidate = OpenVault::from_parts(key, remote, next_disk)?;
    vault::save(&path, &candidate.disk)?;
    *v = candidate;
    drop(guard);
    let members = session.api.members(&id)?;
    Ok(Removal {
        members: views(&session, members),
        exposed,
    })
}

/// Moves one of the member's identities, with its key, to the team part. Editors only.
pub(crate) fn share_identity(
    state: &AppState,
    vault_id: &str,
    identity_id: &str,
) -> Result<View, Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let path = state.active_path()?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    if v.access() != shared::Access::Edit {
        return Err(crate::model::ModelError::ReadOnly.into());
    }
    let mut remote: Remote = v.remote.clone().ok_or(SyncError::NotOnServer)?;
    shared::share_identity(&mut remote.team, &mut remote.private, identity_id)?;
    let mut disk = v.disk.clone();
    disk.dirty = true;
    if let Some(r) = disk.remote.as_mut() {
        r.private_dirty = true;
    }
    let candidate = OpenVault::from_parts(v.key.clone(), remote, disk)?;
    vault::save(&path, &candidate.disk)?;
    *v = candidate;
    drop(guard);
    view(state)
}
