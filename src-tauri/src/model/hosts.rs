use super::{Data, ModelError, Redacted, validate_endpoint, workspaces::prune_layout};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Clone, Debug, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Host {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) address: String,
    // None inherits the nearest group's port, then 22.
    #[serde(default)]
    pub(crate) port: Option<u16>,
    #[serde(default)]
    pub(crate) group_id: String,
    #[serde(default)]
    pub(crate) tags: Vec<String>,
    // Empty with no credentials: inherits the nearest group's identity.
    pub(crate) identity_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) credentials: Option<HostCredentials>,
    pub(crate) fingerprint: String,
    #[serde(default)]
    pub(crate) os: Option<String>,
    #[serde(default)]
    pub(crate) last_connected_at: Option<u64>,
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct HostCredentials {
    #[serde(default)]
    pub(crate) key_id: String,
    pub(crate) username: String,
    pub(crate) password: String,
}
impl std::fmt::Debug for HostCredentials {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HostCredentials")
            .field("username", &self.username)
            .field("password", &Redacted)
            .finish()
    }
}

impl Data {
    pub(crate) fn delete_host(&mut self, id: &str) {
        self.hosts.retain(|h| h.id != id);
        self.workspaces = std::mem::take(&mut self.workspaces)
            .into_iter()
            .filter_map(|mut w| {
                w.layout = prune_layout(&w.layout, id)?;
                Some(w)
            })
            .collect();
    }
    pub(crate) fn upsert_host(&mut self, mut host: Host) -> Result<(), ModelError> {
        if host.name.trim().is_empty() {
            return Err(ModelError::HostFieldsRequired);
        }
        let port = self.effective_port(&host);
        validate_endpoint(&host.address, port)?;
        host.tags = host.tags.iter().map(|tag| tag.trim().to_string()).collect();
        let mut seen = std::collections::HashSet::new();
        host.tags.retain(|tag| seen.insert(tag.to_lowercase()));
        let previous = self
            .hosts
            .iter()
            .find(|h| {
                h.id == host.id && h.address == host.address && self.effective_port(h) == port
            })
            .cloned();
        host.fingerprint = previous
            .as_ref()
            .map(|h| h.fingerprint.clone())
            .unwrap_or_default();
        host.os = previous.as_ref().and_then(|h| h.os.clone());
        host.last_connected_at = previous.as_ref().and_then(|h| h.last_connected_at);
        if let Some(old) = self.hosts.iter_mut().find(|h| h.id == host.id) {
            *old = host;
        } else {
            self.hosts.push(host);
        }
        self.validate()
    }
    // `inherit`: the host has no identity or credentials and uses its group's identity.
    pub(crate) fn upsert_host_inheriting(
        &mut self,
        mut host: Host,
        credentials: Option<HostCredentials>,
        inherit: bool,
    ) -> Result<(), ModelError> {
        if inherit {
            if credentials.is_some() || !host.identity_id.is_empty() {
                return Err(ModelError::InheritConflict);
            }
            host.credentials = None;
        } else if host.identity_id.is_empty() {
            let previous = self
                .hosts
                .iter()
                .find(|h| h.id == host.id)
                .and_then(|h| h.credentials.as_ref());
            let mut credentials = credentials
                .or_else(|| previous.cloned())
                .ok_or(ModelError::CredentialsRequired)?;
            credentials.username = credentials.username.trim().into();
            if credentials.username.is_empty()
                || credentials
                    .username
                    .chars()
                    .any(|c| c.is_control() || c.is_whitespace())
            {
                return Err(ModelError::UsernameInvalid);
            }
            if credentials.key_id.is_empty() {
                if credentials.password.is_empty() {
                    credentials.password = previous
                        .filter(|c| c.key_id.is_empty())
                        .map(|c| c.password.clone())
                        .unwrap_or_default();
                }
                if credentials.password.is_empty() {
                    return Err(ModelError::PasswordRequired);
                }
            } else if !self.keys.iter().any(|k| k.id == credentials.key_id)
                || !credentials.password.is_empty()
            {
                return Err(ModelError::HostCredentialsInvalid);
            }
            host.credentials = Some(credentials);
        } else {
            if credentials.is_some() {
                return Err(ModelError::CredentialsAndIdentity);
            }
            host.credentials = None;
        }
        self.upsert_host(host)
    }
    pub(crate) fn record_connection(
        &mut self,
        id: &str,
        os: Option<String>,
        now_ms: u64,
    ) -> Result<(), ModelError> {
        let host = self
            .hosts
            .iter_mut()
            .find(|h| h.id == id)
            .ok_or(ModelError::HostNotFound)?;
        if let Some(os) = os {
            if os.len() > 80 || os.chars().any(char::is_control) {
                return Err(ModelError::OsInvalid);
            }
            host.os = Some(os);
        }
        host.last_connected_at = Some(host.last_connected_at.unwrap_or(0).max(now_ms));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
    use crate::model::Identity;
    #[test]
    fn direct_keys_and_tags_persist_without_creating_shared_identities() {
        let mut data = Data::default();
        data.upsert_key(key("personal")).unwrap();
        let mut draft = host("direct", "");
        draft.tags = vec![" Production ".into(), "production".into(), "API".into()];
        data.upsert_host_inheriting(
            draft.clone(),
            Some(HostCredentials {
                username: " deploy ".into(),
                password: String::new(),
                key_id: "personal".into(),
            }),
            false,
        )
        .unwrap();
        assert!(data.identities.is_empty());
        let mut restored: Data =
            serde_json::from_slice(&serde_json::to_vec(&data).unwrap()).unwrap();
        assert_eq!(restored.hosts[0].tags, vec!["Production", "API"]);
        let connection = restored.resolve("direct").unwrap();
        assert_eq!(connection.auth, "key");
        assert_eq!(connection.username, "deploy");
        assert!(connection.password.is_empty());
        assert!(!connection.private_key.is_empty());
        assert_eq!(connection.key_name, restored.keys[0].name);
        assert!(restored.delete_key("personal").is_err());
        for (key_id, password) in [
            ("missing", ""),
            ("personal", "conflicting-password"),
            ("", ""),
        ] {
            assert!(
                restored
                    .upsert_host_inheriting(
                        draft.clone(),
                        Some(HostCredentials {
                            username: "root".into(),
                            password: password.into(),
                            key_id: key_id.into(),
                        }),
                        false
                    )
                    .is_err()
            );
        }
        restored
            .upsert_host_inheriting(
                draft,
                Some(HostCredentials {
                    username: "root".into(),
                    password: "new-password".into(),
                    key_id: String::new(),
                }),
                false,
            )
            .unwrap();
        restored.delete_key("personal").unwrap();
        assert_eq!(restored.resolve("direct").unwrap().auth, "password");
    }
    #[test]
    fn private_credentials_roundtrip_and_remain_independent_of_shared_identities() {
        let mut data = Data::default();
        for (id, password) in [("a", "secret-a"), ("b", "secret-b")] {
            data.upsert_host_inheriting(
                host(id, ""),
                Some(HostCredentials {
                    key_id: String::new(),
                    username: "root".into(),
                    password: password.into(),
                }),
                false,
            )
            .unwrap();
        }
        assert!(data.identities.is_empty());
        data.upsert_host_inheriting(
            host("a", ""),
            Some(HostCredentials {
                key_id: String::new(),
                username: "deploy".into(),
                password: String::new(),
            }),
            false,
        )
        .unwrap();
        assert_eq!(data.resolve("a").unwrap().password, "secret-a");
        assert_eq!(data.resolve("b").unwrap().password, "secret-b");
        let mut data: Data = serde_json::from_slice(&serde_json::to_vec(&data).unwrap()).unwrap();
        assert!(!data.migrated);
        assert_eq!(data.schema_version, 6);
        assert_eq!(data.resolve("a").unwrap().username, "deploy");
        data.upsert_identity(Identity {
            id: "shared".into(),
            name: "Shared".into(),
            username: "admin".into(),
            auth: "password".into(),
            key_id: String::new(),
            password: "shared-secret".into(),
        })
        .unwrap();
        data.assign_identity(&["a".into()], "shared").unwrap();
        assert!(data.hosts[0].credentials.is_none());
        assert_eq!(data.resolve("a").unwrap().password, "shared-secret");
        assert_eq!(data.resolve("b").unwrap().password, "secret-b");
        // Schema 3 links are preserved; their names do not imply private ownership.
        let mut old = serde_json::to_value(&data).unwrap();
        old["schema_version"] = 3.into();
        old["hosts"]
            .as_array_mut()
            .unwrap()
            .retain(|h| h["id"] == "a");
        let migrated: Data = serde_json::from_value(old).unwrap();
        assert!(migrated.migrated);
        assert_eq!(migrated.hosts[0].identity_id, "shared");
        assert_eq!(migrated.resolve("a").unwrap().password, "shared-secret");
    }
    #[test]
    fn metadata_is_cached_preserved_on_edits_and_reset_on_endpoint_change() {
        let mut data = Data::default();
        data.upsert_identity(Identity {
            id: "admin".into(),
            name: "Admin".into(),
            username: "root".into(),
            auth: "password".into(),
            key_id: String::new(),
            password: "test".into(),
        })
        .unwrap();
        data.upsert_host(host("h", "admin")).unwrap();
        data.record_connection("h", Some("ubuntu".into()), 100)
            .unwrap();
        data.record_connection("h", None, 90).unwrap();
        assert_eq!(data.hosts[0].os.as_deref(), Some("ubuntu"));
        assert_eq!(data.hosts[0].last_connected_at, Some(100));
        let mut edit = data.hosts[0].clone();
        edit.os = Some("fake".into());
        edit.name = "Renamed".into();
        data.upsert_host(edit).unwrap();
        assert_eq!(data.hosts[0].os.as_deref(), Some("ubuntu"));
        let roundtrip: Data = serde_json::from_slice(&serde_json::to_vec(&data).unwrap()).unwrap();
        assert_eq!(roundtrip.hosts[0].last_connected_at, Some(100));
        let mut edit = data.hosts[0].clone();
        edit.port = Some(2222);
        data.upsert_host(edit).unwrap();
        assert_eq!(data.hosts[0].os, None);
        assert_eq!(data.hosts[0].last_connected_at, None);
    }
}
