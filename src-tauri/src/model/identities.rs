use super::{Data, ModelError, Redacted};
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
impl std::fmt::Debug for Identity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Identity")
            .field("id", &self.id)
            .field("name", &self.name)
            .field("username", &self.username)
            .field("auth", &self.auth)
            .field("key_id", &self.key_id)
            .field("password", &Redacted)
            .finish()
    }
}

impl Data {
    pub(crate) fn upsert_identity(&mut self, mut identity: Identity) -> Result<(), ModelError> {
        if identity.auth == "password" {
            identity.key_id.clear();
            if identity.password.is_empty()
                && let Some(old) = self
                    .identities
                    .iter()
                    .find(|i| i.id == identity.id && i.auth == "password")
            {
                identity.password = old.password.clone();
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
    pub(crate) fn delete_identity(&mut self, id: &str) -> Result<(), ModelError> {
        let used = self.hosts.iter().filter(|h| h.identity_id == id).count()
            + self.groups.iter().filter(|g| g.identity_id == id).count();
        if used > 0 {
            return Err(ModelError::IdentityInUse(used));
        }
        self.identities.retain(|i| i.id != id);
        Ok(())
    }
    pub(crate) fn assign_identity(
        &mut self,
        ids: &[String],
        identity_id: &str,
    ) -> Result<(), ModelError> {
        if ids.is_empty() || !self.identities.iter().any(|i| i.id == identity_id) {
            return Err(ModelError::AssignInvalid);
        }
        if ids.iter().any(|id| !self.hosts.iter().any(|h| &h.id == id)) {
            return Err(ModelError::AssignHostMissing);
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
