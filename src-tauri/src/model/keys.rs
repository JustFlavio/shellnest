use super::Data;
use russh::keys::{decode_secret_key, HashAlg};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SshKey {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) private_key: String,
    pub(crate) passphrase: String,
    pub(crate) fingerprint: String,
}
pub(super) fn key_fingerprint(private_key: &str, passphrase: &str) -> Result<String, String> {
    let key = decode_secret_key(
        private_key,
        if passphrase.is_empty() {
            None
        } else {
            Some(passphrase)
        },
    )
    .map_err(|_| "Chiave privata non valida o passphrase errata".to_string())?;
    Ok(key.public_key().fingerprint(HashAlg::Sha256).to_string())
}
impl Data {
    pub(crate) fn upsert_key(&mut self, mut key: SshKey) -> Result<(), String> {
        if key.name.trim().is_empty() {
            return Err("Assegna un nome alla chiave".into());
        }
        if key.private_key.is_empty() {
            let old = self
                .keys
                .iter()
                .find(|k| k.id == key.id)
                .ok_or("Importa una chiave privata")?;
            key.private_key = old.private_key.clone();
            key.passphrase = old.passphrase.clone();
            key.fingerprint = old.fingerprint.clone();
        } else {
            key.fingerprint = key_fingerprint(&key.private_key, &key.passphrase)?;
            if self
                .keys
                .iter()
                .any(|k| k.id != key.id && k.fingerprint == key.fingerprint)
            {
                return Err("Questa chiave è già presente nel portachiavi".into());
            }
        }
        if let Some(old) = self.keys.iter_mut().find(|k| k.id == key.id) {
            *old = key;
        } else {
            self.keys.push(key);
        }
        self.validate()
    }
    pub(crate) fn delete_key(&mut self, id: &str) -> Result<(), String> {
        let used = self.identities.iter().filter(|i| i.key_id == id).count();
        if used > 0 {
            return Err(format!(
                "Chiave utilizzata da {used} identità. Riassegna prima le identità."
            ));
        }
        self.keys.retain(|k| k.id != id);
        Ok(())
    }
}
