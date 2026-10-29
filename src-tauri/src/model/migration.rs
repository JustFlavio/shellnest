use super::{
    Data, Group, Host, HostCredentials, Identity, SshKey, Workspace, keys::key_fingerprint, new_id,
};
use serde::{Deserialize, Deserializer};
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

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
            return Err(serde::de::Error::custom("Unsupported vault data version"));
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
                    return Err(serde::de::Error::custom("Unsupported legacy method"));
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
                        "Inline credentials are not allowed in schema 2",
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

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
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
}
