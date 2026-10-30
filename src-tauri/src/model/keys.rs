use super::{Data, ModelError, Redacted};
use russh::keys::{HashAlg, decode_secret_key};
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
impl std::fmt::Debug for SshKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SshKey")
            .field("id", &self.id)
            .field("name", &self.name)
            .field("private_key", &Redacted)
            .field("passphrase", &Redacted)
            .field("fingerprint", &self.fingerprint)
            .finish()
    }
}
pub(super) fn key_fingerprint(private_key: &str, passphrase: &str) -> Result<String, ModelError> {
    let key = decode_secret_key(
        private_key,
        if passphrase.is_empty() {
            None
        } else {
            Some(passphrase)
        },
    )
    .map_err(|_| ModelError::KeyUnreadable)?;
    Ok(key.public_key().fingerprint(HashAlg::Sha256).to_string())
}
impl Data {
    pub(crate) fn upsert_key(&mut self, mut key: SshKey) -> Result<(), ModelError> {
        if key.name.trim().is_empty() {
            return Err(ModelError::KeyNameMissing);
        }
        if key.private_key.is_empty() {
            let old = self
                .keys
                .iter()
                .find(|k| k.id == key.id)
                .ok_or(ModelError::KeyImportRequired)?;
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
                return Err(ModelError::KeyDuplicate);
            }
        }
        if let Some(old) = self.keys.iter_mut().find(|k| k.id == key.id) {
            *old = key;
        } else {
            self.keys.push(key);
        }
        self.validate()
    }
    pub(crate) fn delete_key(&mut self, id: &str) -> Result<(), ModelError> {
        let used = self.identities.iter().filter(|i| i.key_id == id).count();
        if used > 0 {
            return Err(ModelError::KeyInUse(used));
        }
        let hosts = self
            .hosts
            .iter()
            .filter(|h| h.credentials.as_ref().is_some_and(|c| c.key_id == id))
            .count();
        if hosts > 0 {
            return Err(ModelError::KeyInUseByHosts(hosts));
        }
        self.keys.retain(|k| k.id != id);
        Ok(())
    }
}
