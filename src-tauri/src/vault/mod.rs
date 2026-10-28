//! Vault encryption and files: a password-derived key seals the data into an `Envelope`, which
//! is written atomically with a `.bak` of the previous version.
mod catalog;
mod error;

pub(crate) use catalog::{VaultCatalog, VaultEntry, valid_vault_id};
pub(crate) use error::VaultError;

use crate::model::{Data, Redacted};
use argon2::Argon2;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use chacha20poly1305::{
    KeyInit, XChaCha20Poly1305, XNonce,
    aead::{Aead, Payload},
};
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};
use zeroize::Zeroizing;

// Part of the encryption: never rename it, or existing vaults stop decrypting.
const AAD: &[u8] = b"server-manager:vault:1";
#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct Envelope {
    pub(crate) version: u8,
    pub(crate) salt: String,
    pub(crate) nonce: String,
    pub(crate) ciphertext: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct Disk {
    pub(crate) envelope: Envelope,
    pub(crate) revision: Option<String>,
    pub(crate) dirty: bool,
}
pub(crate) struct OpenVault {
    pub(crate) key: Zeroizing<[u8; 32]>,
    pub(crate) data: Data,
    pub(crate) disk: Disk,
}
impl std::fmt::Debug for OpenVault {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OpenVault")
            .field("key", &Redacted)
            .field("data", &self.data)
            .finish_non_exhaustive()
    }
}

fn derive(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, VaultError> {
    let mut key = Zeroizing::new([0; 32]);
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(VaultError::Kdf)?;
    Ok(key)
}
pub(crate) fn decrypt(key: &[u8; 32], env: &Envelope) -> Result<Data, VaultError> {
    if env.version != 1 {
        return Err(VaultError::UnsupportedVersion);
    }
    let nonce = B64
        .decode(&env.nonce)
        .map_err(|_| VaultError::InvalidNonce)?;
    if nonce.len() != 24 {
        return Err(VaultError::InvalidNonce);
    }
    let bytes = B64
        .decode(&env.ciphertext)
        .map_err(|_| VaultError::Invalid)?;
    let plain = Zeroizing::new(
        XChaCha20Poly1305::new(key.into())
            .decrypt(
                XNonce::from_slice(&nonce),
                Payload {
                    msg: &bytes,
                    aad: AAD,
                },
            )
            .map_err(|_| VaultError::WrongPassword)?,
    );
    serde_json::from_slice(&plain).map_err(|_| VaultError::InvalidContent)
}
impl OpenVault {
    pub(crate) fn create(password: &str) -> Result<Self, VaultError> {
        if password.chars().count() < 12 {
            return Err(VaultError::PasswordTooShort);
        }
        let mut salt = [0; 16];
        OsRng.fill_bytes(&mut salt);
        let mut v = Self {
            key: derive(password, &salt)?,
            data: Data::default(),
            disk: Disk {
                envelope: Envelope {
                    version: 1,
                    salt: B64.encode(salt),
                    nonce: String::new(),
                    ciphertext: String::new(),
                },
                revision: None,
                dirty: true,
            },
        };
        v.seal()?;
        Ok(v)
    }
    pub(crate) fn unlock(password: &str, disk: Disk) -> Result<Self, VaultError> {
        let salt = B64
            .decode(&disk.envelope.salt)
            .map_err(|_| VaultError::InvalidSalt)?;
        if salt.len() != 16 {
            return Err(VaultError::InvalidSalt);
        }
        Self::unlock_with_key(derive(password, &salt)?, disk)
    }
    // The key a keychain-remembered vault is reopened with, instead of the password.
    pub(crate) fn unlock_with_key(
        key: Zeroizing<[u8; 32]>,
        disk: Disk,
    ) -> Result<Self, VaultError> {
        let data = decrypt(&key, &disk.envelope)?;
        let mut disk = disk;
        disk.dirty |= data.migrated;
        Ok(Self { key, data, disk })
    }
    pub(crate) fn seal(&mut self) -> Result<(), VaultError> {
        self.data.validate()?;
        let mut nonce = [0; 24];
        OsRng.fill_bytes(&mut nonce);
        let plain = Zeroizing::new(serde_json::to_vec(&self.data)?);
        let bytes = XChaCha20Poly1305::new((&*self.key).into())
            .encrypt(
                XNonce::from_slice(&nonce),
                Payload {
                    msg: &plain,
                    aad: AAD,
                },
            )
            .map_err(|_| VaultError::SealFailed)?;
        self.disk.envelope.nonce = B64.encode(nonce);
        self.disk.envelope.ciphertext = B64.encode(bytes);
        self.data.migrated = false;
        Ok(())
    }
}
pub(crate) fn save<T: Serialize>(path: &Path, disk: &T) -> Result<(), VaultError> {
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension("tmp");
    fs::write(&temp, serde_json::to_vec(disk)?)?;
    fs::OpenOptions::new()
        .write(true)
        .open(&temp)
        .and_then(|f| f.sync_all())?;
    // Persist a previous encrypted version for recovery before replacement.
    if path.exists() {
        fs::copy(path, path.with_extension("bak"))?;
    }
    Ok(fs::rename(temp, path)?)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip_and_wrong_password() {
        let v = OpenVault::create("correct horse battery staple").unwrap();
        assert!(OpenVault::unlock("wrong password", v.disk.clone()).is_err());
        assert!(OpenVault::unlock("correct horse battery staple", v.disk).is_ok());
    }
    #[test]
    fn reopens_with_the_saved_key_only_when_it_is_right() {
        let v = OpenVault::create("correct horse battery staple").unwrap();
        assert!(OpenVault::unlock_with_key(Zeroizing::new(*v.key), v.disk.clone()).is_ok());
        assert!(OpenVault::unlock_with_key(Zeroizing::new([7; 32]), v.disk).is_err());
    }
    #[test]
    fn debug_output_of_an_open_vault_hides_its_key() {
        let v = OpenVault::create("correct horse battery staple").unwrap();
        let text = format!("{v:?}");
        assert!(text.contains("<redacted>"));
        for byte_list in [format!("{:?}", *v.key), format!("{:?}", v.key.as_slice())] {
            assert!(!text.contains(&byte_list));
        }
        assert!(!text.contains("correct horse"));
    }
    #[test]
    fn tampering_is_detected_and_nonces_change() {
        let mut v = OpenVault::create("correct horse battery staple").unwrap();
        let first = v.disk.envelope.nonce.clone();
        v.seal().unwrap();
        assert_ne!(first, v.disk.envelope.nonce);
        let mut bytes = B64.decode(&v.disk.envelope.ciphertext).unwrap();
        bytes[0] ^= 1;
        v.disk.envelope.ciphertext = B64.encode(bytes);
        assert!(decrypt(&v.key, &v.disk.envelope).is_err());
    }
    #[test]
    fn encrypted_legacy_vault_upgrades_without_changing_password_or_remote_revision() {
        let mut original = OpenVault::create("correct horse battery staple").unwrap();
        let old = serde_json::json!({"hosts":[{"id":"host-1","name":"Original","address":"192.0.2.1","port":22,"username":"root","group":"Produzione","auth":"password","password":"synthetic-secret","privateKey":"","passphrase":"","fingerprint":"SHA256:original-trust"}],"sync_url":"https://sync.example.com","sync_token":"test-token"});
        let plain = Zeroizing::new(serde_json::to_vec(&old).unwrap());
        let nonce = B64.decode(&original.disk.envelope.nonce).unwrap();
        let cipher = XChaCha20Poly1305::new((&*original.key).into())
            .encrypt(
                XNonce::from_slice(&nonce),
                Payload {
                    msg: &plain,
                    aad: AAD,
                },
            )
            .unwrap();
        original.disk.envelope.ciphertext = B64.encode(cipher);
        original.disk.dirty = false;
        original.disk.revision = Some("remote-revision".into());
        let mut migrated =
            OpenVault::unlock("correct horse battery staple", original.disk).unwrap();
        assert!(migrated.data.migrated);
        assert!(migrated.disk.dirty);
        assert_eq!(migrated.disk.revision.as_deref(), Some("remote-revision"));
        let identity_id = migrated.data.hosts[0].identity_id.clone();
        migrated.seal().unwrap();
        let reopened = OpenVault::unlock("correct horse battery staple", migrated.disk).unwrap();
        assert!(!reopened.data.migrated);
        assert_eq!(reopened.data.hosts[0].identity_id, identity_id);
        assert_eq!(
            reopened.data.resolve("host-1").unwrap().password,
            "synthetic-secret"
        );
        assert_eq!(reopened.data.hosts[0].fingerprint, "SHA256:original-trust");
    }
}
