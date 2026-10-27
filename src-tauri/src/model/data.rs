use super::{Group, Host, Identity, SshKey, Workspace};
use serde::Serialize;
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Clone, Serialize, Zeroize, ZeroizeOnDrop)]
pub(crate) struct Data {
    pub(crate) schema_version: u32,
    pub(crate) hosts: Vec<Host>,
    pub(crate) identities: Vec<Identity>,
    pub(crate) keys: Vec<SshKey>,
    #[zeroize(skip)]
    pub(crate) groups: Vec<Group>,
    #[zeroize(skip)]
    pub(crate) workspaces: Vec<Workspace>,
    pub(crate) sync_url: String,
    pub(crate) sync_token: String,
    #[serde(skip)]
    pub(crate) migrated: bool,
}
impl Default for Data {
    fn default() -> Self {
        Self {
            schema_version: 5,
            hosts: vec![],
            identities: vec![],
            keys: vec![],
            groups: vec![],
            workspaces: vec![],
            sync_url: String::new(),
            sync_token: String::new(),
            migrated: false,
        }
    }
}
