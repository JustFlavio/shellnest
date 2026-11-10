use super::{Group, Host, Identity, SshKey, Workspace};
use serde::Serialize;
use std::fmt;
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Clone, PartialEq, Serialize, Zeroize, ZeroizeOnDrop)]
pub(crate) struct Data {
    pub(crate) schema_version: u32,
    pub(crate) hosts: Vec<Host>,
    pub(crate) identities: Vec<Identity>,
    pub(crate) keys: Vec<SshKey>,
    #[zeroize(skip)]
    pub(crate) groups: Vec<Group>,
    #[zeroize(skip)]
    pub(crate) workspaces: Vec<Workspace>,
    // The settings of the token sync removed in 0.2. Still written, so earlier versions keep opening the vault.
    pub(crate) sync_url: String,
    pub(crate) sync_token: String,
    #[serde(skip)]
    pub(crate) migrated: bool,
    // In a server vault a shared host may have no credentials: each member binds their own.
    #[serde(skip)]
    pub(crate) credentials_optional: bool,
}
// Only counts: the contents are secrets.
impl fmt::Debug for Data {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Data")
            .field("schema_version", &self.schema_version)
            .field("hosts", &self.hosts.len())
            .field("identities", &self.identities.len())
            .field("keys", &self.keys.len())
            .finish_non_exhaustive()
    }
}
impl Default for Data {
    fn default() -> Self {
        Self {
            schema_version: 6,
            hosts: vec![],
            identities: vec![],
            keys: vec![],
            groups: vec![],
            workspaces: vec![],
            sync_url: String::new(),
            sync_token: String::new(),
            migrated: false,
            credentials_optional: false,
        }
    }
}
