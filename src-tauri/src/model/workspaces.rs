use super::{new_id, Data};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

// A saved split layout. Leaves are {"hostId": id} or {"local": true}; splits are {dir, ratio, a, b}.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Workspace {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) layout: serde_json::Value,
}
const MAX_LAYOUT_DEPTH: usize = 8;
pub(super) const MAX_LAYOUT_LEAVES: usize = 16;
pub(super) fn check_layout(
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
pub(super) fn prune_layout(node: &serde_json::Value, host_id: &str) -> Option<serde_json::Value> {
    let obj = node.as_object()?;
    if obj.contains_key("hostId") || obj.contains_key("local") {
        return (obj.get("hostId").and_then(|h| h.as_str()) != Some(host_id)).then(|| node.clone());
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

impl Data {
    pub(crate) fn upsert_workspace(&mut self, mut workspace: Workspace) -> Result<(), String> {
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
    pub(crate) fn delete_workspace(&mut self, id: &str) {
        self.workspaces.retain(|w| w.id != id);
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
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
}
