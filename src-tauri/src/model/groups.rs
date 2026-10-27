use super::{new_id, Data, Host};
use serde::{Deserialize, Serialize};

pub(crate) const MAX_GROUP_DEPTH: usize = 5;
// A folder of hosts. Nested via parent_id; identity and port are defaults for the hosts below it.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Group {
    pub(crate) id: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) parent_id: String,
    #[serde(default)]
    pub(crate) identity_id: String,
    #[serde(default)]
    pub(crate) port: Option<u16>,
}

impl Data {
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
    pub(crate) fn inherited_identity(&self, host: &Host) -> Option<&Group> {
        if !host.identity_id.is_empty() || host.credentials.is_some() {
            return None;
        }
        self.group_ancestry(&host.group_id)
            .into_iter()
            .find(|g| !g.identity_id.is_empty())
    }
    pub(crate) fn effective_identity_id(&self, host: &Host) -> String {
        if !host.identity_id.is_empty() {
            return host.identity_id.clone();
        }
        self.inherited_identity(host)
            .map(|g| g.identity_id.clone())
            .unwrap_or_default()
    }
    pub(crate) fn effective_port(&self, host: &Host) -> u16 {
        host.port
            .or_else(|| {
                self.group_ancestry(&host.group_id)
                    .into_iter()
                    .find_map(|g| g.port)
            })
            .unwrap_or(22)
    }
    pub(crate) fn upsert_group(&mut self, mut group: Group) -> Result<(), String> {
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
    pub(crate) fn delete_group(&mut self, id: &str) -> Result<(), String> {
        if self.groups.iter().any(|g| g.parent_id == id)
            || self.hosts.iter().any(|h| h.group_id == id)
        {
            return Err("La cartella non è vuota: sposta o elimina prima il suo contenuto.".into());
        }
        self.groups.retain(|g| g.id != id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
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
            data.upsert_group(group(level, &format!("L{i}"), &parent))
                .unwrap();
            parent = level.to_string();
        }
        assert!(data.clone().upsert_group(group("f", "Sesto", "e")).is_err());
        assert!(data
            .clone()
            .upsert_group(group("a", "Produzione", "e"))
            .is_err());
        assert!(data
            .clone()
            .upsert_group(group("a", "Produzione", "a"))
            .is_err());
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
}
