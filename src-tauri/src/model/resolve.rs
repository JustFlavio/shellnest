use super::{Data, Host, ModelError, Redacted, new_id};
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub(crate) struct Connection {
    pub(crate) host: Host,
    pub(crate) username: String,
    pub(crate) auth: String,
    pub(crate) password: String,
    pub(crate) private_key: String,
    pub(crate) passphrase: String,
    // For the connection log and the timeline; not a secret.
    pub(crate) key_name: String,
}
impl std::fmt::Debug for Connection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Connection")
            .field("host", &self.host)
            .field("username", &self.username)
            .field("auth", &self.auth)
            .field("password", &Redacted)
            .field("private_key", &Redacted)
            .field("passphrase", &Redacted)
            .field("key_name", &self.key_name)
            .finish()
    }
}

impl Data {
    pub(crate) fn resolve(&self, id: &str) -> Result<Connection, ModelError> {
        let host = self
            .hosts
            .iter()
            .find(|h| h.id == id)
            .ok_or(ModelError::HostNotFound)?;
        self.connection_for(host.clone(), None)
    }
    fn connection_for(
        &self,
        mut host: Host,
        username: Option<&str>,
    ) -> Result<Connection, ModelError> {
        // Downstream code sees the resolved port and identity, never the inherited-from-group blanks.
        host.port = Some(self.effective_port(&host));
        host.identity_id = self.effective_identity_id(&host);
        if let Some(credentials) = &host.credentials {
            let username = username.unwrap_or(&credentials.username).into();
            let password = credentials.password.clone();
            return Ok(Connection {
                host,
                username,
                auth: "password".into(),
                password,
                private_key: String::new(),
                passphrase: String::new(),
                key_name: String::new(),
            });
        }
        let identity = self
            .identities
            .iter()
            .find(|i| i.id == host.identity_id)
            .ok_or(ModelError::IdentityNotFound)?;
        let key = if identity.auth == "key" {
            Some(
                self.keys
                    .iter()
                    .find(|k| k.id == identity.key_id)
                    .ok_or(ModelError::KeyNotFound)?,
            )
        } else {
            None
        };
        Ok(Connection {
            host,
            username: username.unwrap_or(&identity.username).into(),
            auth: identity.auth.clone(),
            password: identity.password.clone(),
            private_key: key.map(|k| k.private_key.clone()).unwrap_or_default(),
            passphrase: key.map(|k| k.passphrase.clone()).unwrap_or_default(),
            key_name: key.map(|k| k.name.clone()).unwrap_or_default(),
        })
    }
    /// A connection to a bare address. With an `identity_id` that identity logs in; without one the
    /// login is inline: the vault key `key_id`, or else `password` (empty: asked during the attempt).
    pub(crate) fn resolve_target(
        &self,
        address: &str,
        port: u16,
        identity_id: &str,
        username: Option<&str>,
        (key_id, password): (&str, &str),
        expected_fingerprint: &str,
    ) -> Result<Connection, ModelError> {
        if address.is_empty()
            || address.len() > 253
            || port == 0
            || !(address.parse::<std::net::IpAddr>().is_ok()
                || address
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-' | b'_')))
        {
            return Err(ModelError::TargetInvalid);
        }
        if username.is_some_and(|u| {
            u.is_empty() || u.len() > 256 || u.chars().any(|c| c.is_control() || c.is_whitespace())
        }) {
            return Err(ModelError::UsernameInvalid);
        }
        use base64::Engine;
        if !expected_fingerprint
            .strip_prefix("SHA256:")
            .and_then(|s| {
                base64::engine::general_purpose::STANDARD_NO_PAD
                    .decode(s)
                    .ok()
            })
            .is_some_and(|b| b.len() == 32)
        {
            return Err(ModelError::FingerprintUnverified);
        }
        let host = Host {
            id: format!("quick-{}", new_id()),
            name: address.into(),
            address: address.into(),
            port: Some(port),
            group_id: String::new(),
            identity_id: identity_id.into(),
            credentials: None,
            fingerprint: expected_fingerprint.into(),
            os: None,
            last_connected_at: None,
        };
        if !identity_id.is_empty() {
            return self.connection_for(host, username);
        }
        let username = username.ok_or(ModelError::UsernameMissing)?;
        let key = if key_id.is_empty() {
            None
        } else {
            Some(
                self.keys
                    .iter()
                    .find(|k| k.id == key_id)
                    .ok_or(ModelError::KeyNotFound)?,
            )
        };
        Ok(Connection {
            host,
            username: username.into(),
            auth: if key.is_some() { "key" } else { "password" }.into(),
            password: if key.is_some() {
                String::new()
            } else {
                password.into()
            },
            private_key: key.map(|k| k.private_key.clone()).unwrap_or_default(),
            passphrase: key.map(|k| k.passphrase.clone()).unwrap_or_default(),
            key_name: key.map(|k| k.name.clone()).unwrap_or_default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
    use crate::model::Identity;
    #[test]
    fn thirty_hosts_share_one_key_and_identity_changes_resolve_live() {
        let mut data = Data::default();
        data.upsert_key(key("personal")).unwrap();
        data.upsert_identity(identity("admin", "personal", "root"))
            .unwrap();
        data.upsert_identity(identity("ubuntu", "personal", "ubuntu"))
            .unwrap();
        for n in 0..30 {
            data.upsert_host(host(&format!("h{n}"), "admin")).unwrap();
        }
        assert_eq!(data.keys.len(), 1);
        assert_eq!(data.identities.len(), 2);
        assert_eq!(data.resolve("h29").unwrap().username, "root");
        data.assign_identity(&["h0".into(), "h29".into()], "ubuntu")
            .unwrap();
        assert_eq!(data.resolve("h29").unwrap().username, "ubuntu");
        assert_eq!(data.resolve("h1").unwrap().username, "root");
        assert_eq!(
            data.resolve("h29").unwrap().private_key,
            data.resolve("h1").unwrap().private_key
        );
        data.upsert_identity(identity("ubuntu", "personal", "deploy"))
            .unwrap();
        assert_eq!(data.resolve("h0").unwrap().username, "deploy");
        let before = data.keys[0].fingerprint.clone();
        let mut replacement = key("personal");
        replacement.name = "Nuova chiave".into();
        data.upsert_key(replacement).unwrap();
        assert_ne!(data.keys[0].fingerprint, before);
        assert_eq!(
            data.resolve("h29").unwrap().private_key,
            data.keys[0].private_key
        );
        assert!(data.delete_key("personal").is_err());
        assert!(data.delete_identity("admin").is_err());
        let stored = serde_json::to_value(&data).unwrap();
        assert!(stored["hosts"][0].get("privateKey").is_none());
        assert!(stored["hosts"][0].get("password").is_none());
        assert!(stored["hosts"][0].get("username").is_none());
    }
    #[test]
    fn quick_targets_reuse_credentials_without_persisting_or_mutating_identity() {
        let mut data = Data::default();
        data.upsert_identity(Identity {
            id: "admin".into(),
            name: "Admin".into(),
            username: "root".into(),
            auth: "password".into(),
            key_id: String::new(),
            password: "test-secret".into(),
        })
        .unwrap();
        use base64::Engine;
        let fp = format!(
            "SHA256:{}",
            base64::engine::general_purpose::STANDARD_NO_PAD.encode([1; 32])
        );
        let quick = data
            .resolve_target("192.0.2.1", 2222, "admin", Some("ubuntu"), ("", ""), &fp)
            .unwrap();
        assert_eq!(quick.username, "ubuntu");
        assert_eq!(quick.password, "test-secret");
        assert!(data.hosts.is_empty());
        assert_eq!(data.identities[0].username, "root");
        assert!(
            data.resolve_target("host; rm", 22, "admin", None, ("", ""), &fp)
                .is_err()
        );
        assert!(
            data.resolve_target("host", 0, "admin", None, ("", ""), &fp)
                .is_err()
        );
        assert!(
            data.resolve_target("host", 22, "admin", None, ("", ""), "SHA256:invalid")
                .is_err()
        );
        assert!(
            data.resolve_target("host", 22, "missing", None, ("", ""), &fp)
                .is_err()
        );
    }
    #[test]
    fn quick_targets_can_log_in_inline_with_a_password_or_a_vault_key() {
        use base64::Engine;
        let fp = format!(
            "SHA256:{}",
            base64::engine::general_purpose::STANDARD_NO_PAD.encode([1; 32])
        );
        let mut data = Data::default();
        data.upsert_key(key("personal")).unwrap();
        let by_password = data
            .resolve_target("192.0.2.1", 22, "", Some("ubuntu"), ("", "typed"), &fp)
            .unwrap();
        assert_eq!(
            (by_password.auth.as_str(), by_password.password.as_str()),
            ("password", "typed")
        );
        let by_key = data
            .resolve_target(
                "192.0.2.1",
                22,
                "",
                Some("ubuntu"),
                ("personal", "ignored"),
                &fp,
            )
            .unwrap();
        assert_eq!(by_key.auth, "key");
        assert!(by_key.password.is_empty() && !by_key.private_key.is_empty());
        // The user is required without an identity, and the key must exist.
        assert!(
            data.resolve_target("192.0.2.1", 22, "", None, ("", ""), &fp)
                .is_err()
        );
        assert!(
            data.resolve_target("192.0.2.1", 22, "", Some("u"), ("missing", ""), &fp)
                .is_err()
        );
        assert!(data.hosts.is_empty() && data.identities.is_empty());
    }
}
