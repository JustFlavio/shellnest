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
    // None inherits the nearest group's port, then 22.
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub group_id: String,
    // Empty with no credentials: inherits the nearest group's identity.
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
pub const MAX_GROUP_DEPTH: usize = 5;
// A folder of hosts. Nested via parent_id; identity and port are defaults for the hosts below it.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Group {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: String,
    #[serde(default)]
    pub identity_id: String,
    #[serde(default)]
    pub port: Option<u16>,
}
// A saved split layout. Leaves are {"hostId": id} or {"local": true}; splits are {dir, ratio, a, b}.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub layout: serde_json::Value,
}
const MAX_LAYOUT_DEPTH: usize = 8;
const MAX_LAYOUT_LEAVES: usize = 16;
fn check_layout(
    node: &serde_json::Value,
    hosts: &HashSet<&str>,
    depth: usize,
    leaves: &mut usize,
) -> bool {
    let Some(obj) = node.as_object() else {
        return false;
    };
    if let Some(id) = obj.get("hostId") {
        *leaves += 1;
        return obj.len() == 1 && id.as_str().is_some_and(|id| hosts.contains(id));
    }
    if obj.get("local") == Some(&serde_json::Value::Bool(true)) {
        *leaves += 1;
        return obj.len() == 1;
    }
    depth < MAX_LAYOUT_DEPTH
        && obj.len() == 4
        && matches!(obj.get("dir").and_then(|d| d.as_str()), Some("row" | "col"))
        && obj
            .get("ratio")
            .and_then(|r| r.as_f64())
            .is_some_and(|r| (0.05..=0.95).contains(&r))
        && ["a", "b"].iter().all(|k| {
            obj.get(*k)
                .is_some_and(|child| check_layout(child, hosts, depth + 1, leaves))
        })
}
// Drops the leaves of a deleted host; a split left with one child collapses into it.
fn prune_layout(node: &serde_json::Value, host_id: &str) -> Option<serde_json::Value> {
    let obj = node.as_object()?;
    if obj.contains_key("hostId") || obj.contains_key("local") {
        return (obj.get("hostId").and_then(|h| h.as_str()) != Some(host_id))
            .then(|| node.clone());
    }
    match (
        obj.get("a").and_then(|a| prune_layout(a, host_id)),
        obj.get("b").and_then(|b| prune_layout(b, host_id)),
    ) {
        (Some(a), Some(b)) => {
            let mut next = obj.clone();
            next.insert("a".into(), a);
            next.insert("b".into(), b);
            Some(serde_json::Value::Object(next))
        }
        (one, other) => one.or(other),
    }
}
#[derive(Clone, Serialize, Zeroize, ZeroizeOnDrop)]
pub struct Data {
    pub schema_version: u32,
    pub hosts: Vec<Host>,
    pub identities: Vec<Identity>,
    pub keys: Vec<SshKey>,
    #[zeroize(skip)]
    pub groups: Vec<Group>,
    #[zeroize(skip)]
    pub workspaces: Vec<Workspace>,
    pub sync_url: String,
    pub sync_token: String,
    #[serde(skip)]
    pub migrated: bool,
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

// Parse old records in a typed, zeroizing structure. Legacy secrets never become JSON Values.
#[derive(Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase")]
struct StoredHost {
    id: String,
    name: String,
    address: String,
    #[serde(default)]
    port: Option<u16>,
    // Before schema 5 a folder was just a name on each host.
    #[serde(default)]
    group: String,
    #[serde(default)]
    group_id: String,
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
    #[serde(default)]
    #[zeroize(skip)]
    groups: Vec<Group>,
    #[serde(default)]
    #[zeroize(skip)]
    workspaces: Vec<Workspace>,
    sync_url: String,
    sync_token: String,
}
impl<'de> Deserialize<'de> for Data {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let stored = StoredData::deserialize(deserializer)?;
        if !matches!(
            stored.schema_version,
            None | Some(1) | Some(2) | Some(3) | Some(4) | Some(5)
        ) {
            return Err(serde::de::Error::custom(
                "Versione dati vault non supportata",
            ));
        }
        let legacy = matches!(stored.schema_version, None | Some(1));
        let mut data = Self {
            schema_version: 5,
            hosts: vec![],
            keys: stored.keys.clone(),
            groups: stored.groups.clone(),
            workspaces: stored.workspaces.clone(),
            identities: stored.identities.clone(),
            sync_url: stored.sync_url.clone(),
            sync_token: stored.sync_token.clone(),
            migrated: stored.schema_version != Some(5),
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
            let legacy_name = legacy_group_name(&h.group);
            let group_id = if !h.group_id.is_empty() || legacy_name.is_empty() {
                h.group_id.clone()
            } else if let Some(g) = data
                .groups
                .iter()
                .find(|g| g.parent_id.is_empty() && g.name == legacy_name)
            {
                g.id.clone()
            } else {
                let id = new_id();
                data.groups.push(Group {
                    id: id.clone(),
                    name: legacy_name,
                    parent_id: String::new(),
                    identity_id: String::new(),
                    port: None,
                });
                id
            };
            data.hosts.push(Host {
                id: h.id.clone(),
                name: h.name.clone(),
                address: h.address.clone(),
                port: h.port,
                group_id,
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
// Folder names written before groups were entities may hold characters groups do not allow.
fn legacy_group_name(name: &str) -> String {
    name.chars()
        .map(|c| if c == '/' || c.is_control() { ' ' } else { c })
        .collect::<String>()
        .trim()
        .chars()
        .take(80)
        .collect()
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
            self.groups.iter().map(|g| &g.id).collect(),
            self.workspaces.iter().map(|w| &w.id).collect(),
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
        for g in &self.groups {
            let mut depth = 1;
            let mut cursor = g;
            while !cursor.parent_id.is_empty() {
                depth += 1;
                cursor = self
                    .groups
                    .iter()
                    .find(|p| p.id == cursor.parent_id)
                    .ok_or("Gruppo padre non trovato")?;
                if depth > MAX_GROUP_DEPTH {
                    return Err(format!(
                        "Le cartelle possono avere al massimo {MAX_GROUP_DEPTH} livelli"
                    ));
                }
            }
            let name = g.name.trim();
            if name.is_empty()
                || name.len() > 80
                || name != g.name
                || name.chars().any(|c| c == '/' || c.is_control())
            {
                return Err("Nome cartella non valido".into());
            }
            if g.port == Some(0)
                || (!g.identity_id.is_empty()
                    && !self.identities.iter().any(|i| i.id == g.identity_id))
            {
                return Err(format!("Impostazioni della cartella {} non valide", g.name));
            }
            if self.groups.iter().any(|o| {
                o.id != g.id
                    && o.parent_id == g.parent_id
                    && o.name.to_lowercase() == g.name.to_lowercase()
            }) {
                return Err(format!("Esiste già una cartella chiamata {}", g.name));
            }
        }
        for h in &self.hosts {
            if h.port == Some(0)
                || (!h.group_id.is_empty() && !self.groups.iter().any(|g| g.id == h.group_id))
            {
                return Err(format!("Porta o cartella non valida per l’host {}", h.name));
            }
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
            } else if h.identity_id.is_empty() {
                if self.inherited_identity(h).is_none() {
                    return Err(format!(
                        "L’host {} non ha un’identità e la sua cartella non ne fornisce una",
                        h.name
                    ));
                }
            } else if !self.identities.iter().any(|i| i.id == h.identity_id) {
                return Err(format!(
                    "L’host {} fa riferimento a un’identità mancante",
                    h.name
                ));
            }
        }
        let host_ids: HashSet<&str> = self.hosts.iter().map(|h| h.id.as_str()).collect();
        for w in &self.workspaces {
            let mut leaves = 0;
            if w.name.trim().is_empty()
                || w.name.len() > 80
                || !check_layout(&w.layout, &host_ids, 0, &mut leaves)
                || leaves > MAX_LAYOUT_LEAVES
            {
                return Err(format!("Workspace {} non valido", w.name));
            }
        }
        Ok(())
    }
    // The group and its ancestors, nearest first.
    fn group_ancestry(&self, group_id: &str) -> Vec<&Group> {
        let mut chain = vec![];
        let mut id = group_id;
        while !id.is_empty() && chain.len() <= MAX_GROUP_DEPTH {
            let Some(group) = self.groups.iter().find(|g| g.id == id) else {
                break;
            };
            chain.push(group);
            id = &group.parent_id;
        }
        chain
    }
    // The group a host takes its identity from: only hosts with no identity and no credentials of their own.
    pub fn inherited_identity(&self, host: &Host) -> Option<&Group> {
        if !host.identity_id.is_empty() || host.credentials.is_some() {
            return None;
        }
        self.group_ancestry(&host.group_id)
            .into_iter()
            .find(|g| !g.identity_id.is_empty())
    }
    pub fn effective_identity_id(&self, host: &Host) -> String {
        if !host.identity_id.is_empty() {
            return host.identity_id.clone();
        }
        self.inherited_identity(host)
            .map(|g| g.identity_id.clone())
            .unwrap_or_default()
    }
    pub fn effective_port(&self, host: &Host) -> u16 {
        host.port
            .or_else(|| {
                self.group_ancestry(&host.group_id)
                    .into_iter()
                    .find_map(|g| g.port)
            })
            .unwrap_or(22)
    }
    pub fn upsert_group(&mut self, mut group: Group) -> Result<(), String> {
        group.name = group.name.trim().to_string();
        if group.id.is_empty() {
            group.id = new_id();
        }
        if let Some(old) = self.groups.iter_mut().find(|g| g.id == group.id) {
            *old = group;
        } else {
            self.groups.push(group);
        }
        // A group cannot move under itself or one of its descendants.
        for g in &self.groups {
            let mut cursor = g;
            let mut hops = 0;
            while !cursor.parent_id.is_empty() {
                if cursor.parent_id == g.id || hops > MAX_GROUP_DEPTH {
                    return Err("Una cartella non può stare dentro se stessa".into());
                }
                hops += 1;
                match self.groups.iter().find(|p| p.id == cursor.parent_id) {
                    Some(parent) => cursor = parent,
                    None => break,
                }
            }
        }
        self.validate()
    }
    pub fn delete_group(&mut self, id: &str) -> Result<(), String> {
        if self.groups.iter().any(|g| g.parent_id == id) || self.hosts.iter().any(|h| h.group_id == id)
        {
            return Err("La cartella non è vuota: sposta o elimina prima il suo contenuto.".into());
        }
        self.groups.retain(|g| g.id != id);
        Ok(())
    }
    pub fn upsert_workspace(&mut self, mut workspace: Workspace) -> Result<(), String> {
        workspace.name = workspace.name.trim().to_string();
        if workspace.id.is_empty() {
            workspace.id = new_id();
        }
        if let Some(old) = self.workspaces.iter_mut().find(|w| w.id == workspace.id) {
            *old = workspace;
        } else {
            self.workspaces.push(workspace);
        }
        self.validate()
    }
    pub fn delete_workspace(&mut self, id: &str) {
        self.workspaces.retain(|w| w.id != id);
    }
    pub fn delete_host(&mut self, id: &str) {
        self.hosts.retain(|h| h.id != id);
        self.workspaces = std::mem::take(&mut self.workspaces)
            .into_iter()
            .filter_map(|mut w| {
                w.layout = prune_layout(&w.layout, id)?;
                Some(w)
            })
            .collect();
    }
    pub fn upsert_host(&mut self, mut host: Host) -> Result<(), String> {
        if host.name.trim().is_empty() {
            return Err("Nome, indirizzo e porta valida sono obbligatori".into());
        }
        let port = self.effective_port(&host);
        validate_endpoint(&host.address, port)?;
        let previous = self
            .hosts
            .iter()
            .find(|h| {
                h.id == host.id
                    && h.address == host.address
                    && self.effective_port(h) == port
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
    pub fn upsert_host_with_credentials(
        &mut self,
        host: Host,
        credentials: Option<HostCredentials>,
    ) -> Result<(), String> {
        self.upsert_host_inheriting(host, credentials, false)
    }
    // `inherit`: the host has no identity or credentials and uses its group's identity.
    pub fn upsert_host_inheriting(
        &mut self,
        mut host: Host,
        credentials: Option<HostCredentials>,
        inherit: bool,
    ) -> Result<(), String> {
        if inherit {
            if credentials.is_some() || !host.identity_id.is_empty() {
                return Err("Eredita l’identità dalla cartella oppure sceglila, non entrambe".into());
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
    fn connection_for(&self, mut host: Host, username: Option<&str>) -> Result<Connection, String> {
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
                port: Some(port),
                group_id: String::new(),
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
            port: Some(22),
            group_id: String::new(),
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
        assert_eq!(data.schema_version, 5);
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
        let future = serde_json::json!({"schema_version":6,"hosts":[],"keys":[],"identities":[],"sync_url":"","sync_token":""});
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
    fn group(id: &str, name: &str, parent: &str) -> Group {
        Group {
            id: id.into(),
            name: name.into(),
            parent_id: parent.into(),
            identity_id: String::new(),
            port: None,
        }
    }
    #[test]
    fn groups_nest_up_to_five_levels_without_cycles_or_duplicate_siblings() {
        let mut data = Data::default();
        data.upsert_group(group("a", "Produzione", "")).unwrap();
        data.upsert_group(group("b", "Api", "a")).unwrap();
        // Failed edits are applied to a copy, as `mutate` does, so the vault stays untouched.
        for (name, parent) in [("produzione", ""), ("Con/barra", ""), ("  ", "")] {
            assert!(data.clone().upsert_group(group("x", name, parent)).is_err());
        }
        let mut parent = "b".to_string();
        for (i, level) in ["c", "d", "e"].iter().enumerate() {
            data.upsert_group(group(level, &format!("L{i}"), &parent)).unwrap();
            parent = level.to_string();
        }
        assert!(data.clone().upsert_group(group("f", "Sesto", "e")).is_err());
        assert!(data.clone().upsert_group(group("a", "Produzione", "e")).is_err());
        assert!(data.clone().upsert_group(group("a", "Produzione", "a")).is_err());
    }
    #[test]
    fn hosts_inherit_identity_and_port_from_the_nearest_group() {
        let mut data = Data::default();
        data.keys.push(key("k"));
        data.identities.push(identity("deploy", "k", "deploy"));
        data.identities.push(identity("root", "k", "root"));
        let mut top = group("top", "Produzione", "");
        top.identity_id = "deploy".into();
        top.port = Some(2200);
        data.upsert_group(top).unwrap();
        let mut api = group("api", "Api", "top");
        api.identity_id = "root".into();
        data.upsert_group(api).unwrap();
        let mut h = host("h", "");
        h.port = None;
        h.group_id = "api".into();
        data.upsert_host_inheriting(h.clone(), None, true).unwrap();
        let host = &data.hosts[0];
        assert_eq!(data.effective_identity_id(host), "root");
        assert_eq!(data.inherited_identity(host).unwrap().id, "api");
        assert_eq!(data.effective_port(host), 2200);
        let connection = data.resolve("h").unwrap();
        assert_eq!(connection.username, "root");
        assert_eq!(connection.host.port, Some(2200));
        // Its own identity or port wins over the group's.
        let mut own = h.clone();
        own.identity_id = "deploy".into();
        own.port = Some(22);
        data.upsert_host_inheriting(own, None, false).unwrap();
        assert_eq!(data.resolve("h").unwrap().username, "deploy");
        assert_eq!(data.effective_port(&data.hosts[0]), 22);
        assert!(data.inherited_identity(&data.hosts[0]).is_none());
        // A host outside any identity-providing group cannot inherit.
        let mut lone = host_in("lone", "");
        lone.group_id = String::new();
        assert!(data.upsert_host_inheriting(lone, None, true).is_err());
        assert!(data.delete_identity("root").is_err());
    }
    fn host_in(id: &str, identity_id: &str) -> Host {
        let mut h = host(id, identity_id);
        h.port = None;
        h
    }
    #[test]
    fn groups_with_content_cannot_be_deleted() {
        let mut data = Data::default();
        data.keys.push(key("k"));
        data.identities.push(identity("i", "k", "root"));
        data.upsert_group(group("a", "A", "")).unwrap();
        data.upsert_group(group("b", "B", "a")).unwrap();
        let mut h = host("h", "i");
        h.group_id = "b".into();
        data.upsert_host(h).unwrap();
        assert!(data.delete_group("a").is_err());
        assert!(data.delete_group("b").is_err());
        data.delete_host("h");
        data.delete_group("b").unwrap();
        data.delete_group("a").unwrap();
        assert!(data.groups.is_empty());
    }
    #[test]
    fn schema_4_folder_names_become_root_groups() {
        let v4 = serde_json::json!({
            "schema_version": 4,
            "hosts": [
                {"id":"1","name":"a","address":"192.0.2.1","port":22,"group":"Prod/Api","fingerprint":"","identityId":"i"},
                {"id":"2","name":"b","address":"192.0.2.2","port":2222,"group":"Prod/Api","fingerprint":"","identityId":"i"},
                {"id":"3","name":"c","address":"192.0.2.3","port":22,"group":"","fingerprint":"","identityId":"i"}
            ],
            "keys": [], "identities": [{"id":"i","name":"I","username":"root","auth":"password","keyId":"","password":"x"}],
            "sync_url":"","sync_token":""
        });
        let data: Data = serde_json::from_value(v4).unwrap();
        assert!(data.migrated);
        assert_eq!(data.schema_version, 5);
        assert_eq!(data.groups.len(), 1);
        assert_eq!(data.groups[0].name, "Prod Api");
        assert_eq!(data.hosts[0].group_id, data.groups[0].id);
        assert_eq!(data.hosts[1].group_id, data.groups[0].id);
        assert!(data.hosts[2].group_id.is_empty());
        assert_eq!(data.hosts[1].port, Some(2222));
        let roundtrip: Data = serde_json::from_slice(&serde_json::to_vec(&data).unwrap()).unwrap();
        assert!(!roundtrip.migrated);
        assert_eq!(roundtrip.groups.len(), 1);
    }
    #[test]
    fn workspaces_validate_layouts_and_follow_deleted_hosts() {
        use serde_json::json;
        let mut data = Data::default();
        data.keys.push(key("k"));
        data.identities.push(identity("i", "k", "root"));
        data.hosts.push(host("h1", "i"));
        data.hosts.push(host("h2", "i"));
        let layout = json!({"dir":"row","ratio":0.5,"a":{"hostId":"h1"},"b":{"hostId":"h2"}});
        data.upsert_workspace(Workspace {
            id: String::new(),
            name: " Db ".into(),
            layout,
        })
        .unwrap();
        assert_eq!(data.workspaces[0].name, "Db");
        assert!(!data.workspaces[0].id.is_empty());
        for bad in [
            json!({"hostId":"missing"}),
            json!({"dir":"diag","ratio":0.5,"a":{"local":true},"b":{"local":true}}),
            json!({"dir":"row","ratio":2.0,"a":{"local":true},"b":{"local":true}}),
        ] {
            let mut copy = data.clone();
            let result = copy.upsert_workspace(Workspace {
                id: "x".into(),
                name: "Bad".into(),
                layout: bad,
            });
            assert!(result.is_err());
        }
        data.delete_host("h1");
        assert_eq!(data.workspaces[0].layout, json!({"hostId":"h2"}));
        data.validate().unwrap();
        data.delete_host("h2");
        assert!(data.workspaces.is_empty());
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
