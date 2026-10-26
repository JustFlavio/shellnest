use russh::keys::{decode_secret_key, HashAlg};
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashSet;
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

pub fn new_id() -> String {
    format!("{:032x}", rand::random::<u128>())
}
pub fn validate_endpoint(address: &str, port: u16) -> Result<(), String> {
    if address.trim().is_empty()
        || address.len() > 253
        || port == 0
        || address.chars().any(|c| {
            c.is_whitespace() || c.is_control() || matches!(c, '/' | '\\' | '@' | '[' | ']')
        })
    {
        return Err("Indirizzo IP o nome host e porta non validi".into());
    }
    Ok(())
}

#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Host {
    pub id: String,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub group: String,
    pub identity_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credentials: Option<HostCredentials>,
    pub fingerprint: String,
    #[serde(default)]
    pub os: Option<String>,
    #[serde(default)]
    pub last_connected_at: Option<u64>,
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Identity {
    pub id: String,
    pub name: String,
    pub username: String,
    pub auth: String,
    pub key_id: String,
    pub password: String,
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HostCredentials {
    pub username: String,
    pub password: String,
}
#[derive(Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SshKey {
    pub id: String,
    pub name: String,
    pub private_key: String,
    pub passphrase: String,
    pub fingerprint: String,
}
#[derive(Clone, Serialize, Zeroize, ZeroizeOnDrop)]
pub struct Data {
    pub schema_version: u32,
    pub hosts: Vec<Host>,
    pub identities: Vec<Identity>,
    pub keys: Vec<SshKey>,
    pub sync_url: String,
    pub sync_token: String,
    #[serde(skip)]
    pub migrated: bool,
}
impl Default for Data {
    fn default() -> Self {
        Self {
            schema_version: 4,
            hosts: vec![],
            identities: vec![],
            keys: vec![],
            sync_url: String::new(),
            sync_token: String::new(),
            migrated: false,
        }
    }
}

// Parse old records in a typed, zeroizing structure. Legacy secrets never become JSON Values.
#[derive(Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase")]
struct StoredHost {
    id: String,
    name: String,
    address: String,
    port: u16,
    group: String,
    fingerprint: String,
    #[serde(default)]
    os: Option<String>,
    #[serde(default)]
    last_connected_at: Option<u64>,
    #[serde(default)]
    identity_id: String,
    #[serde(default)]
    credentials: Option<HostCredentials>,
    #[serde(default)]
    username: String,
    #[serde(default)]
    auth: String,
    #[serde(default)]
    password: String,
    #[serde(default)]
    private_key: String,
    #[serde(default)]
    passphrase: String,
}
#[derive(Deserialize, Zeroize, ZeroizeOnDrop)]
struct StoredData {
    #[serde(default)]
    schema_version: Option<u32>,
    hosts: Vec<StoredHost>,
    #[serde(default)]
    identities: Vec<Identity>,
    #[serde(default)]
    keys: Vec<SshKey>,
    sync_url: String,
    sync_token: String,
}
impl<'de> Deserialize<'de> for Data {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let stored = StoredData::deserialize(deserializer)?;
        if !matches!(
            stored.schema_version,
            None | Some(1) | Some(2) | Some(3) | Some(4)
        ) {
            return Err(serde::de::Error::custom(
                "Versione dati vault non supportata",
            ));
        }
        let legacy = matches!(stored.schema_version, None | Some(1));
        let mut data = Self {
            schema_version: 4,
            hosts: vec![],
            keys: stored.keys.clone(),
            identities: stored.identities.clone(),
            sync_url: stored.sync_url.clone(),
            sync_token: stored.sync_token.clone(),
            migrated: stored.schema_version != Some(4),
        };
        for h in &stored.hosts {
            let identity_id = if legacy {
                if !matches!(h.auth.as_str(), "key" | "password") {
                    return Err(serde::de::Error::custom("Metodo legacy non supportato"));
                }
                let key_id = if h.auth == "key" {
                    let normalized = Zeroizing::new(h.private_key.replace("\r\n", "\n"));
                    let existing = data.keys.iter().find(|k| {
                        Zeroizing::new(k.private_key.replace("\r\n", "\n")).trim()
                            == normalized.trim()
                            && k.passphrase == h.passphrase
                    });
                    let existing = existing.map(|k| k.id.clone());
                    let fingerprint = if existing.is_none() {
                        key_fingerprint(&h.private_key, &h.passphrase).unwrap_or_default()
                    } else {
                        String::new()
                    };
                    let existing = existing.or_else(|| {
                        data.keys
                            .iter()
                            .find(|k| !fingerprint.is_empty() && k.fingerprint == fingerprint)
                            .map(|k| k.id.clone())
                    });
                    if let Some(id) = existing {
                        id
                    } else {
                        let id = new_id();
                        data.keys.push(SshKey {
                            id: id.clone(),
                            name: format!("Chiave importata · {}", h.name),
                            private_key: h.private_key.clone(),
                            passphrase: h.passphrase.clone(),
                            fingerprint,
                        });
                        id
                    }
                } else {
                    String::new()
                };
                if let Some(identity) = data.identities.iter().find(|i| {
                    i.username == h.username
                        && i.auth == h.auth
                        && i.key_id == key_id
                        && (i.auth == "key" || i.password == h.password)
                }) {
                    identity.id.clone()
                } else {
                    let id = new_id();
                    data.identities.push(Identity {
                        id: id.clone(),
                        name: format!("{} · {}", h.username, h.name),
                        username: h.username.clone(),
                        auth: h.auth.clone(),
                        key_id,
                        password: if h.auth == "password" {
                            h.password.clone()
                        } else {
                            String::new()
                        },
                    });
                    id
                }
            } else {
                if !h.username.is_empty()
                    || !h.auth.is_empty()
                    || !h.password.is_empty()
                    || !h.private_key.is_empty()
                    || !h.passphrase.is_empty()
                {
                    return Err(serde::de::Error::custom(
                        "Credenziali inline non ammesse nello schema 2",
                    ));
                }
                h.identity_id.clone()
            };
            data.hosts.push(Host {
                id: h.id.clone(),
                name: h.name.clone(),
                address: h.address.clone(),
                port: h.port,
                group: h.group.clone(),
                fingerprint: h.fingerprint.clone(),
                identity_id,
                credentials: h.credentials.clone(),
                os: h.os.clone(),
                last_connected_at: h.last_connected_at,
            });
        }
        data.validate().map_err(serde::de::Error::custom)?;
        Ok(data)
    }
}
pub fn key_fingerprint(private_key: &str, passphrase: &str) -> Result<String, String> {
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
    pub fn validate(&self) -> Result<(), String> {
        for ids in [
            self.hosts.iter().map(|h| &h.id).collect::<Vec<_>>(),
            self.identities.iter().map(|i| &i.id).collect(),
            self.keys.iter().map(|k| &k.id).collect(),
        ] {
            let mut seen = HashSet::new();
            for id in ids {
                if id.is_empty() || id.len() > 80 || !seen.insert(id) {
                    return Err("Identificativi mancanti o duplicati nel vault".into());
                }
            }
        }
        for i in &self.identities {
            if i.username.trim().is_empty() || i.name.trim().is_empty() {
                return Err("Identità senza nome o utente".into());
            }
            match i.auth.as_str() {
                "key" if self.keys.iter().any(|k| k.id == i.key_id) && i.password.is_empty() => {}
                "password" if i.key_id.is_empty() => {}
                _ => return Err("Identità con riferimento alla chiave non valido".into()),
            }
        }
        for h in &self.hosts {
            if let Some(credentials) = &h.credentials {
                if !h.identity_id.is_empty()
                    || credentials.username.trim().is_empty()
                    || credentials
                        .username
                        .chars()
                        .any(|c| c.is_control() || c.is_whitespace())
                    || credentials.password.is_empty()
                {
                    return Err(
                        "Credenziali dell’host non valide o in conflitto con un’identità".into(),
                    );
                }
            } else if !self.identities.iter().any(|i| i.id == h.identity_id) {
                return Err(format!(
                    "L’host {} fa riferimento a un’identità mancante",
                    h.name
                ));
            }
        }
        Ok(())
    }
    pub fn upsert_host(&mut self, mut host: Host) -> Result<(), String> {
        if host.name.trim().is_empty() {
            return Err("Nome, indirizzo e porta valida sono obbligatori".into());
        }
        validate_endpoint(&host.address, host.port)?;
        let previous = self
            .hosts
            .iter()
            .find(|h| h.id == host.id && h.address == host.address && h.port == host.port)
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
    pub fn upsert_host_with_credentials(
        &mut self,
        mut host: Host,
        credentials: Option<HostCredentials>,
    ) -> Result<(), String> {
        if host.identity_id.is_empty() {
            let previous = self
                .hosts
                .iter()
                .find(|h| h.id == host.id)
                .and_then(|h| h.credentials.as_ref());
            let mut credentials = credentials
                .or_else(|| previous.cloned())
                .ok_or("Inserisci le credenziali dell’host o scegli un’identità")?;
            credentials.username = credentials.username.trim().into();
            if credentials.username.is_empty()
                || credentials
                    .username
                    .chars()
                    .any(|c| c.is_control() || c.is_whitespace())
            {
                return Err("Utente SSH non valido".into());
            }
            if credentials.password.is_empty() {
                credentials.password = previous.map(|c| c.password.clone()).unwrap_or_default();
            }
            if credentials.password.is_empty() {
                return Err("Inserisci una password per questo host".into());
            }
            host.credentials = Some(credentials);
        } else {
            if credentials.is_some() {
                return Err("Scegli credenziali dell’host oppure un’identità, non entrambe".into());
            }
            host.credentials = None;
        }
        self.upsert_host(host)
    }
    pub fn upsert_identity(&mut self, mut identity: Identity) -> Result<(), String> {
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
    pub fn upsert_key(&mut self, mut key: SshKey) -> Result<(), String> {
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
    pub fn delete_identity(&mut self, id: &str) -> Result<(), String> {
        let used = self.hosts.iter().filter(|h| h.identity_id == id).count();
        if used > 0 {
            return Err(format!(
                "Identità utilizzata da {used} host. Riassegna prima gli host."
            ));
        }
        self.identities.retain(|i| i.id != id);
        Ok(())
    }
    pub fn delete_key(&mut self, id: &str) -> Result<(), String> {
        let used = self.identities.iter().filter(|i| i.key_id == id).count();
        if used > 0 {
            return Err(format!(
                "Chiave utilizzata da {used} identità. Riassegna prima le identità."
            ));
        }
        self.keys.retain(|k| k.id != id);
        Ok(())
    }
    pub fn assign_identity(&mut self, ids: &[String], identity_id: &str) -> Result<(), String> {
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
    pub fn resolve(&self, id: &str) -> Result<Connection, String> {
        let host = self
            .hosts
            .iter()
            .find(|h| h.id == id)
            .ok_or("Host non trovato")?;
        self.connection_for(host.clone(), None)
    }
    fn connection_for(&self, host: Host, username: Option<&str>) -> Result<Connection, String> {
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
            });
        }
        let identity = self
            .identities
            .iter()
            .find(|i| i.id == host.identity_id)
            .ok_or("Identità non trovata")?;
        let key = if identity.auth == "key" {
            Some(
                self.keys
                    .iter()
                    .find(|k| k.id == identity.key_id)
                    .ok_or("Chiave non trovata")?,
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
        })
    }
    pub fn resolve_target(
        &self,
        address: &str,
        port: u16,
        identity_id: &str,
        username: Option<&str>,
        expected_fingerprint: &str,
    ) -> Result<Connection, String> {
        if address.is_empty()
            || address.len() > 253
            || port == 0
            || !(address.parse::<std::net::IpAddr>().is_ok()
                || address
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-' | b'_')))
        {
            return Err("Indirizzo o porta non validi".into());
        }
        if username.is_some_and(|u| {
            u.is_empty() || u.len() > 256 || u.chars().any(|c| c.is_control() || c.is_whitespace())
        }) {
            return Err("Utente SSH non valido".into());
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
            return Err("Verifica prima l’impronta del server".into());
        }
        self.connection_for(
            Host {
                id: format!("quick-{}", new_id()),
                name: address.into(),
                address: address.into(),
                port,
                group: String::new(),
                identity_id: identity_id.into(),
                credentials: None,
                fingerprint: expected_fingerprint.into(),
                os: None,
                last_connected_at: None,
            },
            username,
        )
    }
    pub fn record_connection(
        &mut self,
        id: &str,
        os: Option<String>,
        now_ms: u64,
    ) -> Result<(), String> {
        let host = self
            .hosts
            .iter_mut()
            .find(|h| h.id == id)
            .ok_or("Host non trovato")?;
        if let Some(os) = os {
            if os.len() > 80 || os.chars().any(char::is_control) {
                return Err("Sistema operativo non valido".into());
            }
            host.os = Some(os);
        }
        host.last_connected_at = Some(host.last_connected_at.unwrap_or(0).max(now_ms));
        Ok(())
    }
}
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct Connection {
    pub host: Host,
    pub username: String,
    pub auth: String,
    pub password: String,
    pub private_key: String,
    pub passphrase: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn key(id: &str) -> SshKey {
        let secret =
            russh::keys::PrivateKey::random(&mut rand10::rng(), russh::keys::Algorithm::Ed25519)
                .unwrap();
        SshKey {
            id: id.into(),
            name: "Personale".into(),
            private_key: secret.to_openssh(Default::default()).unwrap().to_string(),
            passphrase: String::new(),
            fingerprint: String::new(),
        }
    }
    fn identity(id: &str, key_id: &str, user: &str) -> Identity {
        Identity {
            id: id.into(),
            name: user.into(),
            username: user.into(),
            auth: "key".into(),
            key_id: key_id.into(),
            password: String::new(),
        }
    }
    fn host(id: &str, identity_id: &str) -> Host {
        Host {
            id: id.into(),
            name: id.into(),
            address: "192.0.2.10".into(),
            port: 22,
            group: "Produzione".into(),
            identity_id: identity_id.into(),
            credentials: None,
            fingerprint: String::new(),
            os: None,
            last_connected_at: None,
        }
    }
    #[test]
    fn private_credentials_roundtrip_and_remain_independent_of_shared_identities() {
        let mut data = Data::default();
        for (id, password) in [("a", "secret-a"), ("b", "secret-b")] {
            data.upsert_host_with_credentials(
                host(id, ""),
                Some(HostCredentials {
                    username: "root".into(),
                    password: password.into(),
                }),
            )
            .unwrap();
        }
        assert!(data.identities.is_empty());
        data.upsert_host_with_credentials(
            host("a", ""),
            Some(HostCredentials {
                username: "deploy".into(),
                password: String::new(),
            }),
        )
        .unwrap();
        assert_eq!(data.resolve("a").unwrap().password, "secret-a");
        assert_eq!(data.resolve("b").unwrap().password, "secret-b");
        let mut data: Data = serde_json::from_slice(&serde_json::to_vec(&data).unwrap()).unwrap();
        assert!(!data.migrated);
        assert_eq!(data.schema_version, 4);
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
    fn legacy_migration_deduplicates_keys_identities_and_preserves_trust() {
        let key = key("unused");
        let hosts:Vec<_>=(0..30).map(|n|serde_json::json!({"id":format!("h{n}"),"name":format!("Host {n}"),"address":"192.0.2.10","port":22,"group":"Produzione","username":if n<20{"root"}else{"ubuntu"},"auth":"key","password":"","privateKey":if n%2==0{key.private_key.clone()}else{key.private_key.replace("\r\n","\n").replace('\n',"\r\n")},"passphrase":"","fingerprint":"SHA256:saved-server-fingerprint"})).collect();
        let old = serde_json::json!({"hosts":hosts,"sync_url":"https://sync.example.com","sync_token":"test-token"});
        let migrated: Data = serde_json::from_value(old).unwrap();
        assert!(migrated.migrated);
        assert_eq!(migrated.keys.len(), 1);
        assert_eq!(migrated.identities.len(), 2);
        assert_eq!(migrated.hosts.len(), 30);
        assert_eq!(migrated.resolve("h0").unwrap().username, "root");
        assert_eq!(migrated.resolve("h29").unwrap().username, "ubuntu");
        assert_eq!(
            migrated.hosts[0].fingerprint,
            "SHA256:saved-server-fingerprint"
        );
        assert_eq!(migrated.sync_token, "test-token");
        let roundtrip: Data =
            serde_json::from_slice(&serde_json::to_vec(&migrated).unwrap()).unwrap();
        assert!(!roundtrip.migrated);
        assert_eq!(roundtrip.keys[0].id, migrated.keys[0].id);
    }
    #[test]
    fn legacy_passwords_are_deduplicated_without_crossing_users() {
        let hosts:Vec<_>=[("a","root","same"),("b","root","same"),("c","ubuntu","same"),("d","root","different")].iter().map(|(id,user,password)|serde_json::json!({"id":id,"name":id,"address":"localhost","port":22,"group":"","fingerprint":"","auth":"password","username":user,"password":password,"privateKey":"","passphrase":""})).collect();
        let data: Data = serde_json::from_value(
            serde_json::json!({"hosts":hosts,"sync_url":"","sync_token":""}),
        )
        .unwrap();
        assert_eq!(data.keys.len(), 0);
        assert_eq!(data.identities.len(), 3);
        assert_eq!(data.hosts[0].identity_id, data.hosts[1].identity_id);
        assert_eq!(data.resolve("d").unwrap().password, "different");
    }
    #[test]
    fn duplicate_import_and_dangling_references_are_rejected() {
        let mut data = Data::default();
        let key = key("first");
        let mut duplicate = key.clone();
        duplicate.id = "second".into();
        data.upsert_key(key).unwrap();
        assert!(data.upsert_key(duplicate).is_err());
        assert_eq!(data.keys.len(), 1);
        assert!(data
            .upsert_identity(identity("invalid", "missing", "root"))
            .is_err());
        let mut data = Data::default();
        assert!(data
            .assign_identity(&["missing".into()], "missing")
            .is_err());
        let future = serde_json::json!({"schema_version":5,"hosts":[],"keys":[],"identities":[],"sync_url":"","sync_token":""});
        assert!(serde_json::from_value::<Data>(future).is_err());
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
            .resolve_target("192.0.2.1", 2222, "admin", Some("ubuntu"), &fp)
            .unwrap();
        assert_eq!(quick.username, "ubuntu");
        assert_eq!(quick.password, "test-secret");
        assert!(data.hosts.is_empty());
        assert_eq!(data.identities[0].username, "root");
        assert!(data
            .resolve_target("host; rm", 22, "admin", None, &fp)
            .is_err());
        assert!(data.resolve_target("host", 0, "admin", None, &fp).is_err());
        assert!(data
            .resolve_target("host", 22, "admin", None, "SHA256:invalid")
            .is_err());
        assert!(data
            .resolve_target("host", 22, "missing", None, &fp)
            .is_err());
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
        edit.port = 2222;
        data.upsert_host(edit).unwrap();
        assert_eq!(data.hosts[0].os, None);
        assert_eq!(data.hosts[0].last_connected_at, None);
    }
}
