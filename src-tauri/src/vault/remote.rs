//! A vault kept on a sync server. Its team part is encrypted with a random vault key, which the
//! file keeps wrapped by the account key; the member's private part is encrypted with a key
//! derived from the account key, so other members cannot read it.
use super::{Disk, Envelope, OpenVault, VaultError};
use crate::{
    account::{
        api::Role,
        crypto::{Key, SecretBox, open_box, seal_box, subkey, unwrap_key},
    },
    model::{
        Data,
        shared::{self, Private},
    },
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use zeroize::Zeroizing;

/// The decrypted parts of an open server vault; `OpenVault::data` is their effective view.
#[derive(Clone)]
pub(crate) struct Remote {
    pub(crate) team: Data,
    pub(crate) private: Private,
    pub(crate) private_key: Key,
}
/// What the vault file keeps about the server copy.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteDisk {
    pub(crate) id: String,
    pub(crate) role: Role,
    pub(crate) members: u32,
    /// The vault key, wrapped by the account key.
    pub(crate) key: SecretBox,
    pub(crate) key_epoch: u32,
    /// The server revision of the team part this device last synced, and that version itself:
    /// the base of the next merge.
    pub(crate) revision: u64,
    pub(crate) base: SecretBox,
    pub(crate) private: SecretBox,
    pub(crate) private_revision: u64,
    #[serde(default)]
    pub(crate) private_base: Option<SecretBox>,
    pub(crate) private_dirty: bool,
}

pub(crate) fn team_aad(id: &str) -> Vec<u8> {
    format!("shellnest:vault:2:{id}").into_bytes()
}
pub(crate) fn private_aad(id: &str) -> Vec<u8> {
    format!("shellnest:private:1:{id}").into_bytes()
}
/// Context of the team part as stored on the server: the revision it has there. The server
/// cannot pass an older version off as a newer one, and the client refuses a lower revision than
/// it has seen, so the server cannot roll the vault back.
pub(crate) fn team_wire_aad(id: &str, revision: u64) -> Vec<u8> {
    format!("shellnest:vault:3:{id}:{revision}").into_bytes()
}
/// The same for this member's private part on the server.
pub(crate) fn private_wire_aad(id: &str, revision: u64) -> Vec<u8> {
    format!("shellnest:private:2:{id}:{revision}").into_bytes()
}
/// Context of the vault key, both wrapped locally and sealed to each member.
pub(crate) fn key_aad(id: &str) -> Vec<u8> {
    format!("shellnest:vault-key:1:{id}").into_bytes()
}
pub(crate) fn meta_aad(id: &str) -> Vec<u8> {
    format!("shellnest:meta:1:{id}").into_bytes()
}
pub(crate) fn private_key(account_key: &[u8; 32], id: &str) -> Key {
    subkey(account_key, format!("shellnest:private:{id}").as_bytes())
}

pub(crate) fn seal_part<T: Serialize>(
    key: &[u8; 32],
    value: &T,
    aad: &[u8],
) -> Result<SecretBox, VaultError> {
    let plain = Zeroizing::new(serde_json::to_vec(value)?);
    seal_box(key, &plain, aad).map_err(|_| VaultError::SealFailed)
}
pub(crate) fn open_part<T: DeserializeOwned>(
    key: &[u8; 32],
    sealed: &SecretBox,
    aad: &[u8],
) -> Result<T, VaultError> {
    let plain = open_box(key, sealed, aad).map_err(|_| VaultError::WrongPassword)?;
    serde_json::from_slice(&plain).map_err(|_| VaultError::InvalidContent)
}
pub(crate) fn open_team(
    key: &[u8; 32],
    sealed: &SecretBox,
    aad: &[u8],
) -> Result<Data, VaultError> {
    let mut team: Data = open_part(key, sealed, aad)?;
    team.credentials_optional = true;
    Ok(team)
}
pub(crate) fn open_private(
    key: &[u8; 32],
    sealed: &SecretBox,
    aad: &[u8],
) -> Result<Private, VaultError> {
    open_part(key, sealed, aad)
}
pub(crate) fn as_box(envelope: &Envelope) -> SecretBox {
    SecretBox {
        nonce: envelope.nonce.clone(),
        ciphertext: envelope.ciphertext.clone(),
    }
}
pub(crate) fn as_envelope(sealed: SecretBox) -> Envelope {
    Envelope {
        version: 2,
        salt: String::new(),
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
    }
}

impl OpenVault {
    /// Opens a server vault with the account key.
    pub(crate) fn open_remote(account_key: &[u8; 32], disk: Disk) -> Result<Self, VaultError> {
        let remote = disk.remote.as_ref().ok_or(VaultError::Invalid)?;
        if disk.envelope.version != 2 {
            return Err(VaultError::UnsupportedVersion);
        }
        let key = unwrap_key(account_key, &remote.key, &key_aad(&remote.id))
            .map_err(|_| VaultError::WrongPassword)?;
        let team = open_team(&key, &as_box(&disk.envelope), &team_aad(&remote.id))?;
        let private_key = private_key(account_key, &remote.id);
        let private = open_private(&private_key, &remote.private, &private_aad(&remote.id))?;
        Ok(Self {
            key,
            data: shared::effective(&team, &private),
            disk,
            remote: Some(Remote {
                team,
                private,
                private_key,
            }),
        })
    }
    /// A server vault from its parts, sealed and ready to save.
    pub(crate) fn from_parts(key: Key, remote: Remote, disk: Disk) -> Result<Self, VaultError> {
        let mut vault = Self {
            key,
            data: shared::effective(&remote.team, &remote.private),
            disk,
            remote: Some(remote),
        };
        vault.seal()?;
        Ok(vault)
    }
    pub(crate) fn role(&self) -> Option<Role> {
        self.disk.remote.as_ref().map(|r| r.role)
    }
    pub(crate) fn access(&self) -> shared::Access {
        match self.role() {
            Some(Role::Viewer) => shared::Access::Read,
            _ => shared::Access::Edit,
        }
    }
    // The server-vault half of `seal`.
    pub(super) fn seal_remote(&mut self) -> Result<(), VaultError> {
        let (Some(remote), Some(disk)) = (&self.remote, &mut self.disk.remote) else {
            return Err(VaultError::Invalid);
        };
        shared::check(&remote.team, &remote.private)?;
        self.disk.envelope = as_envelope(seal_part(&self.key, &remote.team, &team_aad(&disk.id))?);
        disk.private = seal_part(&remote.private_key, &remote.private, &private_aad(&disk.id))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::account::crypto::random;
    #[test]
    fn parts_open_only_in_their_own_vault() {
        let key = random::<32>().unwrap();
        let data = Data::default();
        let sealed = seal_part(&key, &data, &team_aad("x")).unwrap();
        assert!(
            open_team(&key, &sealed, &team_aad("x"))
                .unwrap()
                .credentials_optional
        );
        // The server cannot pass one vault's contents off as another's.
        assert!(open_team(&key, &sealed, &team_aad("y")).is_err());
        let private = Private::default();
        let sealed = seal_part(&key, &private, &private_aad("x")).unwrap();
        open_private(&key, &sealed, &private_aad("x")).unwrap();
        assert!(open_private(&key, &sealed, &private_wire_aad("x", 1)).is_err());
        let sealed = seal_part(&key, &data, &team_wire_aad("x", 2)).unwrap();
        assert!(open_team(&key, &sealed, &team_wire_aad("x", 1)).is_err());
    }
}
