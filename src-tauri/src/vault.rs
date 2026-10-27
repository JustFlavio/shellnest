pub use crate::model::{Data, Host, Identity, SshKey};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::{
    aead::{Aead, Payload},
    KeyInit, XChaCha20Poly1305, XNonce,
};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};
use zeroize::Zeroizing;

#[derive(Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub id: String,
    pub name: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct VaultCatalog {
    pub selected: String,
    pub vaults: Vec<VaultEntry>,
}
impl Default for VaultCatalog {
    fn default() -> Self {
        Self {
            selected: "personal".into(),
            vaults: vec![VaultEntry {
                id: "personal".into(),
                name: "Personale".into(),
            }],
        }
    }
}
impl VaultCatalog {
    pub fn load(legacy: &Path) -> Result<Self, String> {
        let catalog = match fs::read(legacy.with_extension("catalog.json")) {
            Ok(bytes) => {
                serde_json::from_slice::<Self>(&bytes).map_err(|_| "Registro vault non valido")?
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Self::default(),
            Err(e) => return Err(e.to_string()),
        };
        let mut ids = std::collections::HashSet::new();
        for entry in &catalog.vaults {
            if !valid_vault_id(&entry.id) || entry.name.trim().is_empty() || !ids.insert(&entry.id)
            {
                return Err("Registro vault non valido".into());
            }
        }
        if !catalog.vaults.iter().any(|v| v.id == "personal")
            || !catalog.vaults.iter().any(|v| v.id == catalog.selected)
        {
            return Err("Registro vault incompleto".into());
        }
        Ok(catalog)
    }
    pub fn persist(&self, legacy: &Path) -> Result<(), String> {
        save(&legacy.with_extension("catalog.json"), self)
    }
    pub fn path_for(legacy: &Path, id: &str) -> Result<std::path::PathBuf, String> {
        if !valid_vault_id(id) {
            return Err("Identificativo vault non valido".into());
        }
        if id == "personal" {
            return Ok(legacy.to_path_buf());
        }
        let stem = legacy
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Percorso vault non valido")?;
        Ok(legacy
            .with_file_name(format!("{stem}-vaults"))
            .join(format!("{id}.json")))
    }
    pub fn selected_path(&self, legacy: &Path) -> Result<std::path::PathBuf, String> {
        Self::path_for(legacy, &self.selected)
    }
    pub fn validate_name(&self, name: &str, except: Option<&str>) -> Result<String, String> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 80 || name.chars().any(char::is_control) {
            return Err("Il nome del vault deve contenere da 1 a 80 caratteri".into());
        }
        if self
            .vaults
            .iter()
            .any(|v| Some(v.id.as_str()) != except && v.name.to_lowercase() == name.to_lowercase())
        {
            return Err("Esiste già un vault con questo nome".into());
        }
        Ok(name.into())
    }
}
pub fn valid_vault_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !matches!(
            id,
            "con"
                | "prn"
                | "aux"
                | "nul"
                | "com1"
                | "com2"
                | "com3"
                | "com4"
                | "com5"
                | "com6"
                | "com7"
                | "com8"
                | "com9"
                | "lpt1"
                | "lpt2"
                | "lpt3"
                | "lpt4"
                | "lpt5"
                | "lpt6"
                | "lpt7"
                | "lpt8"
                | "lpt9"
        )
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

// Part of the encryption: never rename it, or existing vaults stop decrypting.
const AAD: &[u8] = b"server-manager:vault:1";
#[derive(Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub version: u8,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Disk {
    pub envelope: Envelope,
    pub revision: Option<String>,
    pub dirty: bool,
}
pub struct OpenVault {
    pub key: Zeroizing<[u8; 32]>,
    pub data: Data,
    pub disk: Disk,
}

fn derive(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, String> {
    let mut key = Zeroizing::new([0; 32]);
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|e| e.to_string())?;
    Ok(key)
}
pub fn decrypt(key: &[u8; 32], env: &Envelope) -> Result<Data, String> {
    if env.version != 1 {
        return Err("Versione vault non supportata".into());
    }
    let nonce = B64.decode(&env.nonce).map_err(|_| "Nonce non valido")?;
    if nonce.len() != 24 {
        return Err("Nonce non valido".into());
    }
    let bytes = B64
        .decode(&env.ciphertext)
        .map_err(|_| "Vault non valido")?;
    let plain = Zeroizing::new(
        XChaCha20Poly1305::new(key.into())
            .decrypt(
                XNonce::from_slice(&nonce),
                Payload {
                    msg: &bytes,
                    aad: AAD,
                },
            )
            .map_err(|_| "Password errata o vault danneggiato")?,
    );
    serde_json::from_slice(&plain).map_err(|_| "Contenuto vault non valido".into())
}
impl OpenVault {
    pub fn create(password: &str) -> Result<Self, String> {
        if password.chars().count() < 12 {
            return Err("Usa almeno 12 caratteri per la password principale".into());
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
    pub fn unlock(password: &str, disk: Disk) -> Result<Self, String> {
        let salt = B64
            .decode(&disk.envelope.salt)
            .map_err(|_| "Salt non valido")?;
        if salt.len() != 16 {
            return Err("Salt non valido".into());
        }
        Self::unlock_with_key(derive(password, &salt)?, disk)
    }
    // The key a keychain-remembered vault is reopened with, instead of the password.
    pub fn unlock_with_key(key: Zeroizing<[u8; 32]>, disk: Disk) -> Result<Self, String> {
        let data = decrypt(&key, &disk.envelope)?;
        let mut disk = disk;
        disk.dirty |= data.migrated;
        Ok(Self { key, data, disk })
    }
    pub fn seal(&mut self) -> Result<(), String> {
        self.data.validate()?;
        let mut nonce = [0; 24];
        OsRng.fill_bytes(&mut nonce);
        let plain = Zeroizing::new(serde_json::to_vec(&self.data).map_err(|e| e.to_string())?);
        let bytes = XChaCha20Poly1305::new((&*self.key).into())
            .encrypt(
                XNonce::from_slice(&nonce),
                Payload {
                    msg: &plain,
                    aad: AAD,
                },
            )
            .map_err(|_| "Cifratura fallita")?;
        self.disk.envelope.nonce = B64.encode(nonce);
        self.disk.envelope.ciphertext = B64.encode(bytes);
        self.data.migrated = false;
        Ok(())
    }
}
pub fn save<T: Serialize>(path: &Path, disk: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    let temp = path.with_extension("tmp");
    fs::write(&temp, serde_json::to_vec(disk).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    fs::OpenOptions::new()
        .write(true)
        .open(&temp)
        .and_then(|f| f.sync_all())
        .map_err(|e| e.to_string())?;
    // Persist a previous encrypted version for recovery before replacement.
    if path.exists() {
        fs::copy(path, path.with_extension("bak")).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, path).map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vault_paths_and_catalog_names_are_bounded() {
        let legacy = Path::new("root/vault.json");
        assert_eq!(VaultCatalog::path_for(legacy, "personal").unwrap(), legacy);
        assert!(VaultCatalog::path_for(legacy, "../other").is_err());
        assert!(VaultCatalog::path_for(legacy, "con").is_err());
        assert_eq!(
            VaultCatalog::path_for(legacy, "work-1").unwrap(),
            Path::new("root/vault-vaults/work-1.json")
        );
        let catalog = VaultCatalog::default();
        assert!(catalog.validate_name(" PERSONALE ", None).is_err());
        assert!(catalog.validate_name("", None).is_err());
        assert_eq!(catalog.validate_name("  Lavoro  ", None).unwrap(), "Lavoro");
    }
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
