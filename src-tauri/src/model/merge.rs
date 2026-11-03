//! Three-way merge of a vault part: the version both sides started from (`base`), this device's
//! (`local`) and the server's (`remote`). Records match by id and merge field by field: a field
//! changed on one side only takes that change; changed on both, the local value wins, since this
//! device writes last (the server keeps the replaced version in its history). An edit beats a
//! deletion, and a record that a kept record still refers to comes back.
use super::{
    Data, Group, Host, Identity, SshKey, Workspace,
    shared::{GroupBinding, HostBinding, Private, Seen},
    workspaces::{layout_hosts, prune_layout},
};

fn pick<T: Clone + PartialEq>(base: &T, local: &T, remote: &T) -> T {
    (if local == base { remote } else { local }).clone()
}
// Builds the merged record from `local`, taking each listed field through `pick`.
macro_rules! fields {
    ($base:expr, $local:expr, $remote:expr; $($field:ident),+) => {{
        let mut merged = $local.clone();
        $(merged.$field = pick(&$base.$field, &$local.$field, &$remote.$field);)+
        merged
    }};
}

fn merge_list<T: Clone + PartialEq>(
    base: &[T],
    local: &[T],
    remote: &[T],
    id: impl Fn(&T) -> &str,
    fields: impl Fn(&T, &T, &T) -> T,
) -> Vec<T> {
    let find = |list: &[T], key: &str| list.iter().find(|x| id(x) == key).cloned();
    let mut ids: Vec<String> = local.iter().map(|x| id(x).to_owned()).collect();
    for item in remote {
        if !ids.iter().any(|i| i == id(item)) {
            ids.push(id(item).to_owned());
        }
    }
    ids.into_iter()
        .filter_map(|key| {
            let (b, l, r) = (find(base, &key), find(local, &key), find(remote, &key));
            match (b, l, r) {
                (Some(b), Some(l), Some(r)) => Some(fields(&b, &l, &r)),
                // Added on both sides with the same id: keep this device's.
                (None, Some(l), Some(_)) => Some(l),
                (Some(b), Some(l), None) => (l != b).then_some(l),
                (Some(b), None, Some(r)) => (r != b).then_some(r),
                (None, l, r) => l.or(r),
                (Some(_), None, None) => None,
            }
        })
        .collect()
}

fn hosts(b: &Host, l: &Host, r: &Host) -> Host {
    let mut host =
        fields!(b, l, r; name, address, port, group_id, tags, fingerprint, os, last_connected_at);
    // Identity and credentials are one choice: never an identity from one side and a password from the other.
    if (&l.identity_id, &l.credentials) == (&b.identity_id, &b.credentials) {
        host.identity_id = r.identity_id.clone();
        host.credentials = r.credentials.clone();
    }
    host
}
fn identities(b: &Identity, l: &Identity, r: &Identity) -> Identity {
    let mut identity = fields!(b, l, r; name, username);
    if (&l.auth, &l.key_id, &l.password) == (&b.auth, &b.key_id, &b.password) {
        identity.auth = r.auth.clone();
        identity.key_id = r.key_id.clone();
        identity.password = r.password.clone();
    }
    identity
}
fn keys(b: &SshKey, l: &SshKey, r: &SshKey) -> SshKey {
    let mut key = fields!(b, l, r; name);
    if (&l.private_key, &l.passphrase) == (&b.private_key, &b.passphrase) {
        key.private_key = r.private_key.clone();
        key.passphrase = r.passphrase.clone();
        key.fingerprint = r.fingerprint.clone();
    }
    key
}
fn groups(b: &Group, l: &Group, r: &Group) -> Group {
    fields!(b, l, r; name, parent_id, identity_id, port)
}
fn workspaces(b: &Workspace, l: &Workspace, r: &Workspace) -> Workspace {
    fields!(b, l, r; name, layout)
}

/// Merges the team part. The result may still break a rule (two folders with one name, a loop of
/// folders): the caller validates it and keeps the local copy if it does.
pub(crate) fn merge_data(base: &Data, local: &Data, remote: &Data) -> Data {
    let mut merged = local.clone();
    merged.hosts = merge_list(&base.hosts, &local.hosts, &remote.hosts, |h| &h.id, hosts);
    merged.identities = merge_list(
        &base.identities,
        &local.identities,
        &remote.identities,
        |i| &i.id,
        identities,
    );
    merged.keys = merge_list(&base.keys, &local.keys, &remote.keys, |k| &k.id, keys);
    merged.groups = merge_list(
        &base.groups,
        &local.groups,
        &remote.groups,
        |g| &g.id,
        groups,
    );
    merged.workspaces = merge_list(
        &base.workspaces,
        &local.workspaces,
        &remote.workspaces,
        |w| &w.id,
        workspaces,
    );
    merged.schema_version = local.schema_version.max(remote.schema_version);
    restore_references(&mut merged, [base, local, remote]);
    merged
}

// A record deleted on one side while the other side started using it comes back from wherever it
// still exists; a reference to a record that is gone everywhere is cleared.
fn restore_references(data: &mut Data, sources: [&Data; 3]) {
    loop {
        let mut restored = false;
        let missing_groups: Vec<String> = data
            .hosts
            .iter()
            .map(|h| h.group_id.clone())
            .chain(data.groups.iter().map(|g| g.parent_id.clone()))
            .filter(|id| !id.is_empty() && !data.groups.iter().any(|g| &g.id == id))
            .collect();
        for id in missing_groups {
            if let Some(group) = sources
                .iter()
                .find_map(|s| s.groups.iter().find(|g| g.id == id))
            {
                data.groups.push(group.clone());
                restored = true;
            } else {
                data.hosts
                    .iter_mut()
                    .filter(|h| h.group_id == id)
                    .for_each(|h| h.group_id.clear());
                data.groups
                    .iter_mut()
                    .filter(|g| g.parent_id == id)
                    .for_each(|g| g.parent_id.clear());
            }
        }
        let missing_identities: Vec<String> = data
            .hosts
            .iter()
            .map(|h| h.identity_id.clone())
            .chain(data.groups.iter().map(|g| g.identity_id.clone()))
            .filter(|id| !id.is_empty() && !data.identities.iter().any(|i| &i.id == id))
            .collect();
        for id in missing_identities {
            if let Some(identity) = sources
                .iter()
                .find_map(|s| s.identities.iter().find(|i| i.id == id))
            {
                data.identities.push(identity.clone());
                restored = true;
            } else {
                data.hosts
                    .iter_mut()
                    .filter(|h| h.identity_id == id)
                    .for_each(|h| h.identity_id.clear());
                data.groups
                    .iter_mut()
                    .filter(|g| g.identity_id == id)
                    .for_each(|g| g.identity_id.clear());
            }
        }
        let missing_keys: Vec<String> = data
            .identities
            .iter()
            .map(|i| i.key_id.clone())
            .chain(
                data.hosts
                    .iter()
                    .filter_map(|h| h.credentials.as_ref().map(|c| c.key_id.clone())),
            )
            .filter(|id| !id.is_empty() && !data.keys.iter().any(|k| &k.id == id))
            .collect();
        for id in missing_keys {
            if let Some(key) = sources
                .iter()
                .find_map(|s| s.keys.iter().find(|k| k.id == id))
            {
                data.keys.push(key.clone());
                restored = true;
            }
        }
        if !restored {
            break;
        }
    }
    let host_ids: Vec<String> = data.hosts.iter().map(|h| h.id.clone()).collect();
    prune_workspaces(&mut data.workspaces, &host_ids);
}
fn prune_workspaces(workspaces: &mut Vec<Workspace>, host_ids: &[String]) {
    *workspaces = std::mem::take(workspaces)
        .into_iter()
        .filter_map(|mut w| {
            for id in layout_hosts(&w.layout) {
                if !host_ids.contains(&id) {
                    w.layout = prune_layout(&w.layout, &id)?;
                }
            }
            Some(w)
        })
        .collect();
}

fn host_bindings(b: &HostBinding, l: &HostBinding, r: &HostBinding) -> HostBinding {
    (if (&l.identity_id, &l.credentials) == (&b.identity_id, &b.credentials) {
        r
    } else {
        l
    })
    .clone()
}
fn group_bindings(b: &GroupBinding, l: &GroupBinding, r: &GroupBinding) -> GroupBinding {
    pick(b, l, r)
}
fn seen(_: &Seen, l: &Seen, r: &Seen) -> Seen {
    // The most recent connection, from whichever device made it.
    (if r.last_connected_at > l.last_connected_at {
        r
    } else {
        l
    })
    .clone()
}

/// Merges one member's private part between their own devices.
pub(crate) fn merge_private(base: &Private, local: &Private, remote: &Private) -> Private {
    let mut merged = Private {
        identities: merge_list(
            &base.identities,
            &local.identities,
            &remote.identities,
            |i| &i.id,
            identities,
        ),
        keys: merge_list(&base.keys, &local.keys, &remote.keys, |k| &k.id, keys),
        hosts: merge_list(
            &base.hosts,
            &local.hosts,
            &remote.hosts,
            |b| &b.host_id,
            host_bindings,
        ),
        groups: merge_list(
            &base.groups,
            &local.groups,
            &remote.groups,
            |b| &b.group_id,
            group_bindings,
        ),
        seen: merge_list(&base.seen, &local.seen, &remote.seen, |s| &s.host_id, seen),
        workspaces: merge_list(
            &base.workspaces,
            &local.workspaces,
            &remote.workspaces,
            |w| &w.id,
            workspaces,
        ),
    };
    // Bring back identities and keys a kept binding or identity still uses.
    let sources = [base, local, remote];
    loop {
        let wanted: Vec<String> = merged
            .hosts
            .iter()
            .map(|b| b.identity_id.clone())
            .chain(merged.groups.iter().map(|b| b.identity_id.clone()))
            .filter(|id| !id.is_empty() && !merged.identities.iter().any(|i| &i.id == id))
            .collect();
        let restored: Vec<Identity> = wanted
            .iter()
            .filter_map(|id| {
                sources
                    .iter()
                    .find_map(|s| s.identities.iter().find(|i| &i.id == id))
                    .cloned()
            })
            .collect();
        let keys: Vec<SshKey> = merged
            .identities
            .iter()
            .chain(restored.iter())
            .map(|i| i.key_id.clone())
            .chain(
                merged
                    .hosts
                    .iter()
                    .filter_map(|b| b.credentials.as_ref().map(|c| c.key_id.clone())),
            )
            .filter(|id| !id.is_empty() && !merged.keys.iter().any(|k| &k.id == id))
            .filter_map(|id| {
                sources
                    .iter()
                    .find_map(|s| s.keys.iter().find(|k| k.id == id))
                    .cloned()
            })
            .collect();
        if restored.is_empty() && keys.is_empty() {
            break;
        }
        merged.identities.extend(restored);
        for key in keys {
            if !merged.keys.iter().any(|k| k.id == key.id) {
                merged.keys.push(key);
            }
        }
    }
    merged
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
    fn login(id: &str) -> Identity {
        let mut login = identity(id, "", "root");
        login.auth = "password".into();
        login.password = "synthetic-secret".into();
        login
    }
    fn base() -> Data {
        let mut data = Data::default();
        data.upsert_identity(login("admin")).unwrap();
        data.upsert_host(host("web", "admin")).unwrap();
        data.upsert_host(host("db", "admin")).unwrap();
        data
    }
    #[test]
    fn changes_to_different_hosts_and_fields_both_survive() {
        let base = base();
        let mut local = base.clone();
        local.hosts[0].name = "Web (local)".into();
        let mut remote = base.clone();
        remote.hosts[0].port = Some(2222);
        remote.hosts[1].tags = vec!["db".into()];
        remote.upsert_host(host("cache", "admin")).unwrap();
        let merged = merge_data(&base, &local, &remote);
        assert_eq!(merged.hosts.len(), 3);
        assert_eq!(merged.hosts[0].name, "Web (local)");
        assert_eq!(merged.hosts[0].port, Some(2222));
        assert_eq!(merged.hosts[1].tags, vec!["db".to_string()]);
        merged.validate().unwrap();
    }
    #[test]
    fn the_same_field_changed_on_both_sides_keeps_this_device() {
        let base = base();
        let mut local = base.clone();
        local.hosts[0].port = Some(2200);
        let mut remote = base.clone();
        remote.hosts[0].port = Some(2222);
        assert_eq!(merge_data(&base, &local, &remote).hosts[0].port, Some(2200));
    }
    #[test]
    fn an_edit_beats_a_deletion_and_brings_back_what_it_uses() {
        let base = base();
        let mut local = base.clone();
        local.hosts.retain(|h| h.id != "web");
        let mut remote = base.clone();
        remote.hosts[0].name = "Web renamed".into();
        let merged = merge_data(&base, &local, &remote);
        assert!(merged.hosts.iter().any(|h| h.name == "Web renamed"));

        // Deleted the identity here, assigned it to a new host there: it comes back.
        let mut local = base.clone();
        local.hosts.clear();
        local.identities.clear();
        let mut remote = base.clone();
        remote.upsert_host(host("new", "admin")).unwrap();
        let merged = merge_data(&base, &local, &remote);
        assert_eq!(merged.identities.len(), 1);
        assert_eq!(merged.hosts.len(), 1);
        merged.validate().unwrap();
    }
    #[test]
    fn credentials_never_mix_halves_from_two_sides() {
        let base = base();
        let mut local = base.clone();
        local.identities[0].password = "local-secret".into();
        let mut remote = base.clone();
        remote.identities[0].username = "deploy".into();
        let merged = merge_data(&base, &local, &remote);
        assert_eq!(merged.identities[0].password, "local-secret");
        assert_eq!(merged.identities[0].username, "deploy");
    }
    #[test]
    fn private_parts_keep_the_latest_connection_and_the_identities_bindings_use() {
        let mut base = Private::default();
        base.identities.push(login("mine"));
        base.seen.push(Seen {
            host_id: "web".into(),
            os: None,
            last_connected_at: Some(1),
        });
        let mut local = base.clone();
        local.seen[0].last_connected_at = Some(5);
        local.identities.clear();
        let mut remote = base.clone();
        remote.seen[0].last_connected_at = Some(9);
        remote.hosts.push(HostBinding {
            host_id: "web".into(),
            identity_id: "mine".into(),
            credentials: None,
        });
        let merged = merge_private(&base, &local, &remote);
        assert_eq!(merged.seen[0].last_connected_at, Some(9));
        assert_eq!(merged.hosts.len(), 1);
        assert_eq!(merged.identities.len(), 1);
    }
}
