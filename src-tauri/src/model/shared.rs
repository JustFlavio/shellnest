//! A vault on the sync server has two parts. The **team** part (`Data`) is what every member sees:
//! hosts, folders, fingerprints and the identities and keys someone chose to share. The
//! **private** part is one member's own, synced only between their devices: their identities and
//! keys, which credentials they use for which host or folder, workspaces and connection history.
//!
//! The commands keep working on one `Data`, the *effective* view of both parts. After an edit,
//! `split` compares the view before and after and sends each change to the part it belongs to.
use super::{Data, Group, Host, HostCredentials, Identity, ModelError, SshKey, Workspace};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// The member's own credentials for a shared host: an identity, or a user and password or key.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct HostBinding {
    pub(crate) host_id: String,
    #[serde(default)]
    pub(crate) identity_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) credentials: Option<HostCredentials>,
}
/// The member's own default identity for the hosts of a shared folder.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct GroupBinding {
    pub(crate) group_id: String,
    pub(crate) identity_id: String,
}
/// When the member last connected to a host, and what it runs.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Seen {
    pub(crate) host_id: String,
    #[serde(default)]
    pub(crate) os: Option<String>,
    #[serde(default)]
    pub(crate) last_connected_at: Option<u64>,
}
#[derive(Clone, Default, PartialEq, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Private {
    #[serde(default)]
    pub(crate) identities: Vec<Identity>,
    #[serde(default)]
    pub(crate) keys: Vec<SshKey>,
    #[serde(default)]
    pub(crate) hosts: Vec<HostBinding>,
    #[serde(default)]
    #[zeroize(skip)]
    pub(crate) groups: Vec<GroupBinding>,
    #[serde(default)]
    #[zeroize(skip)]
    pub(crate) seen: Vec<Seen>,
    #[serde(default)]
    #[zeroize(skip)]
    pub(crate) workspaces: Vec<Workspace>,
}
// Only counts: the contents are secrets.
impl std::fmt::Debug for Private {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Private")
            .field("identities", &self.identities.len())
            .field("keys", &self.keys.len())
            .field("hosts", &self.hosts.len())
            .finish_non_exhaustive()
    }
}

/// What the member may change in the team part.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Access {
    Edit,
    Read,
}

/// The two parts as one `Data`: private identities, keys and workspaces added, the member's
/// bindings in place of the team's assignments, their connection history on each host.
pub(crate) fn effective(team: &Data, private: &Private) -> Data {
    let mut data = team.clone();
    data.credentials_optional = true;
    // An identity shared from another device is in both parts until this one syncs: the team copy wins.
    let identities: Vec<_> = private
        .identities
        .iter()
        .filter(|i| !team.identities.iter().any(|t| t.id == i.id))
        .cloned()
        .collect();
    let keys: Vec<_> = private
        .keys
        .iter()
        .filter(|k| !team.keys.iter().any(|t| t.id == k.id))
        .cloned()
        .collect();
    data.identities.extend(identities);
    data.keys.extend(keys);
    data.workspaces.extend(private.workspaces.iter().cloned());
    let identity_exists = |data: &Data, id: &str| data.identities.iter().any(|i| i.id == id);
    for binding in &private.groups {
        if identity_exists(&data, &binding.identity_id)
            && let Some(group) = data.groups.iter_mut().find(|g| g.id == binding.group_id)
        {
            group.identity_id = binding.identity_id.clone();
        }
    }
    let usable = |data: &Data, b: &HostBinding| match &b.credentials {
        Some(c) => c.key_id.is_empty() || data.keys.iter().any(|k| k.id == c.key_id),
        None => b.identity_id.is_empty() || identity_exists(data, &b.identity_id),
    };
    let bindings: Vec<_> = private.hosts.iter().filter(|b| usable(&data, b)).collect();
    let host_ids: std::collections::HashSet<String> =
        data.hosts.iter().map(|h| h.id.clone()).collect();
    for host in &mut data.hosts {
        if let Some(b) = bindings.iter().find(|b| b.host_id == host.id) {
            host.identity_id = b.identity_id.clone();
            host.credentials = b.credentials.clone();
        }
        if let Some(seen) = private.seen.iter().find(|s| s.host_id == host.id) {
            host.os = seen.os.clone();
            host.last_connected_at = seen.last_connected_at;
        }
    }
    // A colleague may have deleted a host that one of the private workspaces still shows.
    data.workspaces = std::mem::take(&mut data.workspaces)
        .into_iter()
        .filter_map(|mut w| {
            for id in super::workspaces::layout_hosts(&w.layout) {
                if !host_ids.contains(&id) {
                    w.layout = super::workspaces::prune_layout(&w.layout, &id)?;
                }
            }
            Some(w)
        })
        .collect();
    data
}

/// Separates a vault that was local until now: hosts and folders become the team part, without
/// credentials; identities, keys, assignments, workspaces and history become the private part.
pub(crate) fn separate(data: &Data) -> (Data, Private) {
    let mut team = data.clone();
    team.credentials_optional = true;
    let mut private = Private::default();
    private.identities = std::mem::take(&mut team.identities);
    private.keys = std::mem::take(&mut team.keys);
    private.workspaces = std::mem::take(&mut team.workspaces);
    for host in &mut team.hosts {
        if !host.identity_id.is_empty() || host.credentials.is_some() {
            private.hosts.push(HostBinding {
                host_id: host.id.clone(),
                identity_id: std::mem::take(&mut host.identity_id),
                credentials: host.credentials.take(),
            });
        }
        if host.os.is_some() || host.last_connected_at.is_some() {
            private.seen.push(Seen {
                host_id: host.id.clone(),
                os: host.os.take(),
                last_connected_at: host.last_connected_at.take(),
            });
        }
    }
    for group in &mut team.groups {
        if !group.identity_id.is_empty() {
            private.groups.push(GroupBinding {
                group_id: group.id.clone(),
                identity_id: std::mem::take(&mut group.identity_id),
            });
        }
    }
    (team, private)
}

fn changed<T: PartialEq>(before: Option<&T>, after: &T) -> bool {
    before != Some(after)
}
fn require(access: Access) -> Result<(), ModelError> {
    match access {
        Access::Edit => Ok(()),
        Access::Read => Err(ModelError::ReadOnly),
    }
}
// Identities, keys and workspaces live in one part or the other; new ones are private.
fn split_records<T: Clone + PartialEq>(
    before: &[T],
    after: &[T],
    team: &mut Vec<T>,
    private: &mut Vec<T>,
    id: impl Fn(&T) -> &str,
    access: Access,
) -> Result<(), ModelError> {
    for item in after {
        let old = before.iter().find(|b| id(b) == id(item));
        if !changed(old, item) {
            continue;
        }
        if let Some(slot) = team.iter_mut().find(|t| id(t) == id(item)) {
            require(access)?;
            *slot = item.clone();
        } else if let Some(slot) = private.iter_mut().find(|p| id(p) == id(item)) {
            *slot = item.clone();
        } else {
            private.push(item.clone());
        }
    }
    for item in before {
        if after.iter().any(|a| id(a) == id(item)) {
            continue;
        }
        if team.iter().any(|t| id(t) == id(item)) {
            require(access)?;
            team.retain(|t| id(t) != id(item));
        }
        private.retain(|p| id(p) != id(item));
    }
    Ok(())
}

/// Where a new assignment of credentials goes. A team identity chosen by an editor is the team's
/// assignment for everyone; anything else (a private identity, own credentials, a viewer's
/// choice) is the member's own binding. Choosing nothing removes the member's binding, and
/// clears the team's assignment too when that was what the member saw.
enum Assignment {
    Team(String),
    Own,
    Clear { team: bool },
}
fn assignment(
    identity_id: &str,
    own_credentials: bool,
    team: &Data,
    had_binding: bool,
    access: Access,
) -> Assignment {
    if own_credentials {
        return Assignment::Own;
    }
    if identity_id.is_empty() {
        return Assignment::Clear {
            team: access == Access::Edit && !had_binding,
        };
    }
    if access == Access::Edit && team.identities.iter().any(|i| i.id == identity_id) {
        return Assignment::Team(identity_id.into());
    }
    Assignment::Own
}

// The host as the team part keeps it: the team's assignment, no credentials, no history.
fn team_host(host: &Host, identity_id: String) -> Host {
    let mut host = host.clone();
    host.identity_id = identity_id;
    host.credentials = None;
    host.os = None;
    host.last_connected_at = None;
    host
}
fn same_host_fields(a: &Host, b: &Host) -> bool {
    a.name == b.name
        && a.address == b.address
        && a.port == b.port
        && a.group_id == b.group_id
        && a.tags == b.tags
        && a.fingerprint == b.fingerprint
}
fn same_group_fields(a: &Group, b: &Group) -> bool {
    a.name == b.name && a.parent_id == b.parent_id && a.port == b.port
}

/// Sends the changes between two effective views to the part each belongs to. A viewer may only
/// change their private part; anything else is refused with `ModelError::ReadOnly`.
pub(crate) fn split(
    before: &Data,
    after: &Data,
    team: &Data,
    private: &Private,
    access: Access,
) -> Result<(Data, Private), ModelError> {
    let mut t = team.clone();
    let mut p = private.clone();
    split_records(
        &before.identities,
        &after.identities,
        &mut t.identities,
        &mut p.identities,
        |i| &i.id,
        access,
    )?;
    split_records(
        &before.keys,
        &after.keys,
        &mut t.keys,
        &mut p.keys,
        |k| &k.id,
        access,
    )?;
    split_records(
        &before.workspaces,
        &after.workspaces,
        &mut t.workspaces,
        &mut p.workspaces,
        |w| &w.id,
        access,
    )?;

    for group in &after.groups {
        let old = before.groups.iter().find(|g| g.id == group.id);
        if !changed(old, group) {
            continue;
        }
        let had_binding = p.groups.iter().any(|b| b.group_id == group.id);
        let identity_changed = old.is_none_or(|o| o.identity_id != group.identity_id);
        let slot = match t.groups.iter().position(|g| g.id == group.id) {
            Some(i) => i,
            None => {
                require(access)?;
                t.groups.push(Group {
                    identity_id: String::new(),
                    ..group.clone()
                });
                t.groups.len() - 1
            }
        };
        if old.is_some_and(|o| !same_group_fields(o, group)) {
            require(access)?;
            let identity_id = t.groups[slot].identity_id.clone();
            t.groups[slot] = Group {
                identity_id,
                ..group.clone()
            };
        }
        if identity_changed {
            p.groups.retain(|b| b.group_id != group.id);
            match assignment(&group.identity_id, false, &t, had_binding, access) {
                Assignment::Team(id) => t.groups[slot].identity_id = id,
                Assignment::Clear { team } => {
                    if team {
                        t.groups[slot].identity_id.clear();
                    }
                }
                Assignment::Own => p.groups.push(GroupBinding {
                    group_id: group.id.clone(),
                    identity_id: group.identity_id.clone(),
                }),
            }
        }
    }
    for group in &before.groups {
        if !after.groups.iter().any(|g| g.id == group.id) {
            require(access)?;
            t.groups.retain(|g| g.id != group.id);
            p.groups.retain(|b| b.group_id != group.id);
        }
    }

    for host in &after.hosts {
        let old = before.hosts.iter().find(|h| h.id == host.id);
        if !changed(old, host) {
            continue;
        }
        let had_binding = p.hosts.iter().any(|b| b.host_id == host.id);
        let slot = match t.hosts.iter().position(|h| h.id == host.id) {
            Some(i) => i,
            None => {
                require(access)?;
                t.hosts.push(team_host(host, String::new()));
                t.hosts.len() - 1
            }
        };
        if old.is_some_and(|o| !same_host_fields(o, host)) {
            require(access)?;
            let identity_id = t.hosts[slot].identity_id.clone();
            t.hosts[slot] = team_host(host, identity_id);
        }
        let credentials_changed = old
            .is_none_or(|o| o.identity_id != host.identity_id || o.credentials != host.credentials);
        if credentials_changed {
            p.hosts.retain(|b| b.host_id != host.id);
            match assignment(
                &host.identity_id,
                host.credentials.is_some(),
                &t,
                had_binding,
                access,
            ) {
                Assignment::Team(id) => t.hosts[slot].identity_id = id,
                Assignment::Clear { team } => {
                    if team {
                        t.hosts[slot].identity_id.clear();
                    }
                }
                Assignment::Own => p.hosts.push(HostBinding {
                    host_id: host.id.clone(),
                    identity_id: host.identity_id.clone(),
                    credentials: host.credentials.clone(),
                }),
            }
        }
        if old.is_none_or(|o| o.os != host.os || o.last_connected_at != host.last_connected_at) {
            p.seen.retain(|s| s.host_id != host.id);
            if host.os.is_some() || host.last_connected_at.is_some() {
                p.seen.push(Seen {
                    host_id: host.id.clone(),
                    os: host.os.clone(),
                    last_connected_at: host.last_connected_at,
                });
            }
        }
    }
    for host in &before.hosts {
        if !after.hosts.iter().any(|h| h.id == host.id) {
            require(access)?;
            t.delete_host(&host.id);
            p.hosts.retain(|b| b.host_id != host.id);
            p.seen.retain(|s| s.host_id != host.id);
        }
    }
    check(&t, &p)?;
    Ok((t, p))
}

/// The team part never holds a member's own credentials, and both parts together are a valid
/// vault.
pub(crate) fn check(team: &Data, private: &Private) -> Result<(), ModelError> {
    if team.hosts.iter().any(|h| h.credentials.is_some()) {
        return Err(ModelError::HostCredentialsInvalid);
    }
    let mut team = team.clone();
    team.credentials_optional = true;
    team.validate()?;
    effective(&team, private).validate()
}

/// Moves a private identity, and its key, to the team part: from now on every member can use it.
pub(crate) fn share_identity(
    team: &mut Data,
    private: &mut Private,
    id: &str,
) -> Result<(), ModelError> {
    let index = private
        .identities
        .iter()
        .position(|i| i.id == id)
        .ok_or(ModelError::IdentityNotFound)?;
    let identity = private.identities.remove(index);
    if let Some(index) = private.keys.iter().position(|k| k.id == identity.key_id) {
        team.keys.push(private.keys.remove(index));
    }
    team.identities.push(identity);
    check(team, private)
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
    fn login(id: &str, user: &str) -> Identity {
        let mut login = identity(id, "", user);
        login.auth = "password".into();
        login.password = "synthetic-secret".into();
        login
    }
    fn shared() -> (Data, Private) {
        let mut data = Data::default();
        data.upsert_identity(login("mine", "mario")).unwrap();
        data.upsert_group(Group {
            id: "prod".into(),
            name: "Production".into(),
            parent_id: String::new(),
            identity_id: "mine".into(),
            port: None,
        })
        .unwrap();
        let mut web = host("web", "mine");
        web.group_id = "prod".into();
        data.upsert_host(web).unwrap();
        data.record_connection("web", None, 10).unwrap();
        separate(&data)
    }
    fn edit(
        team: &Data,
        private: &Private,
        access: Access,
        f: impl FnOnce(&mut Data) -> Result<(), ModelError>,
    ) -> Result<(Data, Private), ModelError> {
        let before = effective(team, private);
        let mut after = before.clone();
        f(&mut after)?;
        split(&before, &after, team, private, access)
    }
    #[test]
    fn separating_keeps_credentials_and_history_out_of_the_team_part() {
        let (team, private) = shared();
        assert!(team.identities.is_empty());
        assert_eq!(team.hosts[0].identity_id, "");
        assert_eq!(team.hosts[0].last_connected_at, None);
        assert_eq!(team.groups[0].identity_id, "");
        assert_eq!(private.identities.len(), 1);
        assert_eq!(private.hosts[0].identity_id, "mine");
        assert_eq!(private.groups[0].identity_id, "mine");
        let view = effective(&team, &private);
        assert_eq!(view.hosts[0].identity_id, "mine");
        assert_eq!(view.hosts[0].last_connected_at, Some(10));
        assert_eq!(view.resolve("web").unwrap().username, "mario");
        check(&team, &private).unwrap();
    }
    #[test]
    fn edits_go_to_their_part_and_new_identities_stay_private() {
        let (team, private) = shared();
        let (team, private) = edit(&team, &private, Access::Edit, |d| {
            d.upsert_identity(login("second", "deploy"))?;
            let mut web = d.hosts[0].clone();
            web.name = "Web 1".into();
            web.identity_id = "second".into();
            d.upsert_host(web)
        })
        .unwrap();
        assert_eq!(team.hosts[0].name, "Web 1");
        assert_eq!(team.hosts[0].identity_id, "");
        assert!(team.identities.is_empty());
        assert_eq!(private.identities.len(), 2);
        assert_eq!(private.hosts[0].identity_id, "second");
    }
    #[test]
    fn a_team_identity_chosen_by_an_editor_is_for_everyone_and_a_viewer_only_binds() {
        let (mut team, mut private) = shared();
        share_identity(&mut team, &mut private, "mine").unwrap();
        assert_eq!(team.identities.len(), 1);
        private.hosts.clear();
        let (edited, edited_private) = edit(&team, &private, Access::Edit, |d| {
            d.assign_identity(&["web".into()], "mine")
        })
        .unwrap();
        assert_eq!(edited.hosts[0].identity_id, "mine");
        assert!(edited_private.hosts.is_empty());

        let (viewer_team, viewer_private) = edit(&team, &private, Access::Read, |d| {
            d.assign_identity(&["web".into()], "mine")
        })
        .unwrap();
        assert_eq!(viewer_team, team);
        assert_eq!(viewer_private.hosts[0].identity_id, "mine");
    }
    #[test]
    fn viewers_cannot_change_the_team_part() {
        let (team, private) = shared();
        for change in [
            (|d: &mut Data| {
                let mut web = d.hosts[0].clone();
                web.fingerprint = "SHA256:other".into();
                d.hosts[0] = web;
                Ok(())
            }) as fn(&mut Data) -> Result<(), ModelError>,
            |d| {
                d.delete_host("web");
                Ok(())
            },
            |d| d.upsert_host(host("new", "")),
            |d| {
                d.groups[0].name = "Renamed".into();
                Ok(())
            },
        ] {
            assert!(matches!(
                edit(&team, &private, Access::Read, change),
                Err(ModelError::ReadOnly)
            ));
        }
        // Their own history and identities are theirs.
        let (same_team, private) = edit(&team, &private, Access::Read, |d| {
            d.record_connection("web", Some("debian".into()), 20)?;
            d.upsert_identity(login("viewer-own", "anna"))
        })
        .unwrap();
        assert_eq!(same_team, team);
        assert_eq!(private.seen[0].os.as_deref(), Some("debian"));
    }
    #[test]
    fn own_credentials_never_reach_the_team_part() {
        let (team, private) = shared();
        let (team, private) = edit(&team, &private, Access::Edit, |d| {
            d.upsert_host_inheriting(
                host("db", ""),
                Some(HostCredentials {
                    key_id: String::new(),
                    username: "postgres".into(),
                    password: "synthetic-secret".into(),
                }),
                false,
            )
        })
        .unwrap();
        let db = team.hosts.iter().find(|h| h.id == "db").unwrap();
        assert!(db.credentials.is_none());
        assert!(
            !serde_json::to_string(&team)
                .unwrap()
                .contains("synthetic-secret")
        );
        assert_eq!(
            private
                .hosts
                .iter()
                .find(|b| b.host_id == "db")
                .unwrap()
                .credentials
                .as_ref()
                .unwrap()
                .username,
            "postgres"
        );
        let mut forged = team.clone();
        forged.hosts[0].credentials =
            private.hosts[0]
                .credentials
                .clone()
                .or(Some(HostCredentials {
                    key_id: String::new(),
                    username: "x".into(),
                    password: "y".into(),
                }));
        assert!(check(&forged, &private).is_err());
    }
    #[test]
    fn hosts_without_credentials_are_allowed_but_cannot_connect() {
        let (team, _) = shared();
        let view = effective(&team, &Private::default());
        view.validate().unwrap();
        assert!(matches!(
            view.resolve("web"),
            Err(ModelError::HostWithoutIdentity(_))
        ));
    }
    #[test]
    fn a_deleted_host_drops_the_bindings_and_workspaces_that_named_it() {
        let (team, mut private) = shared();
        private.workspaces.push(Workspace {
            id: "w".into(),
            name: "Both".into(),
            layout: serde_json::json!({"dir":"row","ratio":0.5,"a":{"hostId":"web"},"b":{"local":true}}),
        });
        let mut gone = team.clone();
        gone.hosts.clear();
        let view = effective(&gone, &private);
        assert_eq!(
            view.workspaces[0].layout,
            serde_json::json!({"local": true})
        );
        view.validate().unwrap();
    }
}
