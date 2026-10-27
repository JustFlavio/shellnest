use super::Data;
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Identity {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) username: String,
    pub(crate) auth: String,
    pub(crate) key_id: String,
    pub(crate) password: String,
}

impl Data {
    pub(crate) fn upsert_identity(&mut self, mut identity: Identity) -> Result<(), String> {
        if identity.auth == "password" {
            identity.key_id.clear();
            if identity.password.is_empty() {
                if let Some(old) = self
                    .identities
                    .iter()
                    .find(|i| i.id == identity.id && i.auth == "password")
                {
                    identity.password = old.password.clone();
                }
            }
        } else {
            identity.password.clear();
        }
        if let Some(old) = self.identities.iter_mut().find(|i| i.id == identity.id) {
            *old = identity;
        } else {
            self.identities.push(identity);
        }
        self.validate()
    }
    pub(crate) fn delete_identity(&mut self, id: &str) -> Result<(), String> {
        let used = self.hosts.iter().filter(|h| h.identity_id == id).count()
            + self.groups.iter().filter(|g| g.identity_id == id).count();
        if used > 0 {
            return Err(format!(
                "Identità utilizzata da {used} host o cartelle. Riassegnali prima."
            ));
        }
        self.identities.retain(|i| i.id != id);
        Ok(())
    }
    pub(crate) fn assign_identity(
        &mut self,
        ids: &[String],
        identity_id: &str,
    ) -> Result<(), String> {
        if ids.is_empty() || !self.identities.iter().any(|i| i.id == identity_id) {
            return Err("Seleziona host e identità validi".into());
        }
        if ids.iter().any(|id| !self.hosts.iter().any(|h| &h.id == id)) {
            return Err("Uno degli host selezionati non esiste più".into());
        }
        for host in &mut self.hosts {
            if ids.contains(&host.id) {
                host.identity_id = identity_id.into();
                host.credentials = None;
            }
        }
        self.validate()
    }
}
