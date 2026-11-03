//! The sync client. A server vault is pulled, merged with the local changes and pushed back as
//! encrypted parts: the team part shared by the members and the private part of this member.
//! Nothing decrypted ever leaves the device.
pub(crate) mod members;
pub(crate) mod vaults;

use crate::{
    account::{
        api::{Api, Role},
        crypto::{CryptoError, Key, open_sealed, wrap_key},
    },
    error::Error,
    model::{
        Data, merge_data, merge_private,
        shared::{self, Private},
    },
    state::AppState,
    vault::{
        self, Disk, OpenVault,
        remote::{
            Remote, RemoteDisk, key_aad, meta_aad, open_part, open_private, open_team, seal_part,
            seal_private, team_aad,
        },
    },
    view::{View, view},
};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

/// Why the sync, or an account operation, failed. The UI translates the code.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum SyncError {
    #[error("Invalid URL")]
    UrlInvalid,
    #[error("Use HTTPS; HTTP is only allowed on localhost")]
    InsecureUrl,
    #[error("URLs with credentials, a query or a fragment are not allowed")]
    UrlParts,
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Http(#[from] reqwest::Error),
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Crypto(#[from] CryptoError),
    #[error("The session has expired: sign in again")]
    Unauthorized,
    #[error("Wrong username or password")]
    WrongLogin,
    #[error("Wrong password")]
    WrongPassword,
    #[error("Too many attempts: try again in a few minutes")]
    TooManyAttempts,
    #[error("The invite is invalid, used or expired")]
    InviteInvalid,
    #[error("This username is taken")]
    UsernameTaken,
    #[error("Wrong username or recovery key")]
    RecoveryInvalid,
    #[error("Use at least 12 characters for the password")]
    PasswordTooShort,
    #[error("You are not allowed to do this in the vault")]
    NotAllowed,
    #[error("Not found on the server")]
    NotFound,
    #[error("No user with this name")]
    UserNotFound,
    #[error("The vault changed on the server meanwhile: try again")]
    Conflict,
    #[error("The vault is too large for the server")]
    TooLarge,
    #[error("Sync failed (HTTP {0})")]
    #[serde(serialize_with = "crate::error::status_code")]
    Status(StatusCode),
    #[error("The server sent an invalid answer")]
    RemoteInvalid,
    #[error("Your access to this vault was removed: the local copy is kept")]
    AccessRevoked,
    #[error("Sign in to the sync server first")]
    NotSignedIn,
    #[error("This device is already signed in")]
    AlreadySignedIn,
    #[error("The account file is damaged")]
    AccountInvalid,
    #[error("The account could not be saved")]
    AccountNotSaved,
    #[error("This vault is not on the server")]
    NotOnServer,
    #[error("The vault is already on the server")]
    AlreadyOnServer,
    #[error("The local and remote changes cannot be combined: the local copy is kept")]
    MergeFailed,
    #[error("A vault needs at least one owner")]
    LastOwner,
    #[error(
        "This person's key has changed since you last shared with them: check their safety code"
    )]
    PublicKeyChanged,
    #[error("Sync the vaults with unsent changes first")]
    UnsyncedChanges,
}

// A write that loses the race with another device pulls again; after a few rounds, give up.
const ATTEMPTS: usize = 3;

/// The vault name, encrypted with the vault key on the server.
#[derive(Serialize, Deserialize)]
pub(crate) struct Meta {
    pub(crate) name: String,
}

/// What a sync needs from the open account, copied out so its lock is not held over the network.
pub(crate) struct Session {
    pub(crate) api: Api,
    pub(crate) user_id: String,
    pub(crate) key: Key,
    pub(crate) secret: Key,
    pub(crate) public: [u8; 32],
}
impl Session {
    pub(crate) fn of(state: &AppState) -> Result<Self, Error> {
        let account = state.account()?;
        let account = account.as_ref().ok_or(SyncError::NotSignedIn)?;
        Ok(Self {
            api: account.api()?,
            user_id: account.file.user_id.clone(),
            key: account.key.clone(),
            secret: account.secret.clone(),
            public: account.public()?,
        })
    }
}

/// Brings the open server vault in step with the server, in both directions.
pub(crate) fn synchronize(state: &AppState, vault_id: &str) -> Result<View, Error> {
    let session = Session::of(state)?;
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let path = state.active_path()?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    let (candidate, name) = exchange(&session, v)?;
    vault::save(&path, &candidate.disk)?;
    *v = candidate;
    drop(guard);
    if let Some(name) = name {
        vaults::rename_entry(state, vault_id, &name)?;
    }
    view(state)
}

/// Pulls, merges and pushes both parts; returns the vault to save and the name on the server.
pub(crate) fn exchange(s: &Session, v: &OpenVault) -> Result<(OpenVault, Option<String>), Error> {
    let disk = v.disk.remote.as_ref().ok_or(SyncError::NotOnServer)?;
    let local = v.remote.as_ref().ok_or(SyncError::NotOnServer)?;
    let id = disk.id.clone();
    let mut key = v.key.clone();
    let mut remote_disk = disk.clone();
    let mut base: Data = open_team(&key, &disk.base, &id)?;
    let mut team = local.team.clone();
    let mut name = None;
    for attempt in 0..=ATTEMPTS {
        if attempt == ATTEMPTS {
            return Err(SyncError::Conflict.into());
        }
        let reply = s.api.vault(&id)?;
        if reply.key_epoch != remote_disk.key_epoch {
            // The owner replaced the vault key (someone was removed); the old base used the old key.
            key = open_sealed(&s.secret, &reply.sealed_key, &key_aad(&id))?;
            remote_disk.key = wrap_key(&s.key, &key, &key_aad(&id))?;
            remote_disk.key_epoch = reply.key_epoch;
        }
        remote_disk.role = reply.role;
        remote_disk.members = reply.members;
        name = open_part::<Meta>(&key, &reply.meta, &meta_aad(&id))
            .ok()
            .map(|m| m.name);
        let envelope = reply.envelope.ok_or(SyncError::RemoteInvalid)?;
        if reply.revision != remote_disk.revision {
            let theirs = open_team(&key, &envelope, &id)?;
            team = if team != base && reply.role != Role::Viewer {
                let merged = merge_data(&base, &team, &theirs);
                shared::check(&merged, &local.private).map_err(|_| SyncError::MergeFailed)?;
                merged
            } else {
                theirs.clone()
            };
            base = theirs;
            remote_disk.revision = reply.revision;
            remote_disk.base = envelope;
        }
        // A viewer sends nothing of the team part: edits left from before a demotion are dropped.
        if reply.role == Role::Viewer {
            team = base.clone();
        }
        if team == base {
            break;
        }
        let sealed = seal_part(&key, &team, &team_aad(&id))?;
        match s
            .api
            .put_data(&id, remote_disk.revision, remote_disk.key_epoch, &sealed)
        {
            Ok(revision) => {
                remote_disk.revision = revision;
                remote_disk.base = sealed;
                break;
            }
            Err(SyncError::Conflict) => continue,
            Err(e) => return Err(e.into()),
        }
    }
    let private = sync_private(s, &local.private_key, &id, &local.private, &mut remote_disk)?;
    let disk = Disk {
        envelope: v.disk.envelope.clone(),
        dirty: false,
        remote: Some(remote_disk),
    };
    let remote = Remote {
        team,
        private,
        private_key: local.private_key.clone(),
    };
    Ok((OpenVault::from_parts(key, remote, disk)?, name))
}

fn sync_private(
    s: &Session,
    key: &[u8; 32],
    id: &str,
    local: &Private,
    disk: &mut RemoteDisk,
) -> Result<Private, Error> {
    let mut private = local.clone();
    let mut base = match &disk.private_base {
        Some(sealed) => open_private(key, sealed, id)?,
        None => Private::default(),
    };
    for attempt in 0..=ATTEMPTS {
        if attempt == ATTEMPTS {
            return Err(SyncError::Conflict.into());
        }
        let remote = s.api.private(id)?;
        let revision = remote.as_ref().map_or(0, |r| r.revision);
        if revision != disk.private_revision {
            let stored = remote.ok_or(SyncError::RemoteInvalid)?;
            let theirs = open_private(key, &stored.envelope, id)?;
            private = if private != base {
                merge_private(&base, &private, &theirs)
            } else {
                theirs.clone()
            };
            base = theirs;
            disk.private_revision = revision;
            disk.private_base = Some(stored.envelope);
        }
        if private == base && disk.private_revision > 0 {
            break;
        }
        let sealed = seal_private(key, &private, id)?;
        match s.api.put_private(id, disk.private_revision, &sealed) {
            Ok(revision) => {
                disk.private_revision = revision;
                disk.private_base = Some(sealed);
                break;
            }
            Err(SyncError::Conflict) => continue,
            Err(e) => return Err(e.into()),
        }
    }
    disk.private_dirty = false;
    Ok(private)
}
