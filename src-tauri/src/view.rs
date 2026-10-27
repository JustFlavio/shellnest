use crate::{
    error::Error,
    model::{self, Host},
    state::AppState,
    vault,
};
use serde::Serialize;

#[derive(Serialize)]
pub(crate) struct VaultView {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) exists: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostView {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) address: String,
    // Effective port; own_port is None when it comes from a group (or the 22 default).
    pub(crate) port: u16,
    pub(crate) own_port: Option<u16>,
    pub(crate) group_id: String,
    pub(crate) identity_id: String,
    pub(crate) effective_identity_id: String,
    // The group an inherited identity comes from; empty when the host has its own.
    pub(crate) identity_source: String,
    pub(crate) username: Option<String>,
    pub(crate) has_password: bool,
    pub(crate) fingerprint: String,
    pub(crate) os: Option<String>,
    pub(crate) last_connected_at: Option<u64>,
}
impl HostView {
    fn new(h: &Host, data: &model::Data) -> Self {
        Self {
            id: h.id.clone(),
            name: h.name.clone(),
            address: h.address.clone(),
            port: data.effective_port(h),
            own_port: h.port,
            group_id: h.group_id.clone(),
            identity_id: h.identity_id.clone(),
            effective_identity_id: data.effective_identity_id(h),
            identity_source: data
                .inherited_identity(h)
                .map(|g| g.id.clone())
                .unwrap_or_default(),
            username: h.credentials.as_ref().map(|c| c.username.clone()),
            has_password: h
                .credentials
                .as_ref()
                .is_some_and(|c| !c.password.is_empty()),
            fingerprint: h.fingerprint.clone(),
            os: h.os.clone(),
            last_connected_at: h.last_connected_at,
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IdentityView {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) username: String,
    pub(crate) auth: String,
    pub(crate) key_id: String,
    pub(crate) has_password: bool,
    pub(crate) host_count: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KeyView {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) fingerprint: String,
    pub(crate) identity_count: usize,
    pub(crate) host_count: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct View {
    pub(crate) vault_id: String,
    pub(crate) vault_name: String,
    pub(crate) vaults: Vec<VaultView>,
    pub(crate) exists: bool,
    pub(crate) unlocked: bool,
    pub(crate) hosts: Vec<HostView>,
    pub(crate) identities: Vec<IdentityView>,
    pub(crate) keys: Vec<KeyView>,
    pub(crate) groups: Vec<model::Group>,
    pub(crate) workspaces: Vec<model::Workspace>,
    pub(crate) sync_url: String,
    pub(crate) sync_configured: bool,
    pub(crate) dirty: bool,
}
pub(crate) fn view(s: &AppState) -> Result<View, Error> {
    let guard = s.vault()?;
    let catalog = s.catalog()?;
    let selected = catalog
        .vaults
        .iter()
        .find(|v| v.id == catalog.selected)
        .ok_or(Error::VaultNotFound)?;
    let vaults = || -> Vec<VaultView> {
        catalog
            .vaults
            .iter()
            .map(|entry| VaultView {
                id: entry.id.clone(),
                name: entry.name.clone(),
                exists: vault::VaultCatalog::path_for(&s.path, &entry.id).is_ok_and(|p| p.exists()),
            })
            .collect()
    };
    Ok(match guard.as_ref() {
        Some(v) => View {
            vault_id: selected.id.clone(),
            vault_name: selected.name.clone(),
            vaults: vaults(),
            exists: true,
            unlocked: true,
            hosts: v
                .data
                .hosts
                .iter()
                .map(|h| HostView::new(h, &v.data))
                .collect(),
            groups: v.data.groups.clone(),
            identities: v
                .data
                .identities
                .iter()
                .map(|i| IdentityView {
                    id: i.id.clone(),
                    name: i.name.clone(),
                    username: i.username.clone(),
                    auth: i.auth.clone(),
                    key_id: i.key_id.clone(),
                    has_password: !i.password.is_empty(),
                    host_count: v
                        .data
                        .hosts
                        .iter()
                        .filter(|h| h.identity_id == i.id)
                        .count(),
                })
                .collect(),
            keys: v
                .data
                .keys
                .iter()
                .map(|k| KeyView {
                    id: k.id.clone(),
                    name: k.name.clone(),
                    fingerprint: k.fingerprint.clone(),
                    identity_count: v
                        .data
                        .identities
                        .iter()
                        .filter(|i| i.key_id == k.id)
                        .count(),
                    host_count: v
                        .data
                        .hosts
                        .iter()
                        .filter(|h| {
                            v.data
                                .identities
                                .iter()
                                .any(|i| i.id == h.identity_id && i.key_id == k.id)
                        })
                        .count(),
                })
                .collect(),
            workspaces: v.data.workspaces.clone(),
            sync_url: v.data.sync_url.clone(),
            sync_configured: !v.data.sync_token.is_empty(),
            dirty: v.disk.dirty,
        },
        None => View {
            vault_id: selected.id.clone(),
            vault_name: selected.name.clone(),
            vaults: vaults(),
            exists: catalog.selected_path(&s.path)?.exists(),
            unlocked: false,
            hosts: vec![],
            identities: vec![],
            keys: vec![],
            groups: vec![],
            workspaces: vec![],
            sync_url: String::new(),
            sync_configured: false,
            dirty: false,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{commands::mutate, model::Identity, vault::OpenVault};
    use std::path::PathBuf;
    #[test]
    fn snapshots_hide_secrets_and_invalid_edits_do_not_change_the_vault() {
        let mut v = OpenVault::create("test-only master password").unwrap();
        v.data
            .upsert_identity(Identity {
                id: "login".into(),
                name: "Admin".into(),
                username: "root".into(),
                auth: "password".into(),
                key_id: String::new(),
                password: "synthetic-secret-do-not-expose".into(),
            })
            .unwrap();
        v.data
            .upsert_host(Host {
                id: "server".into(),
                name: "Server".into(),
                address: "192.0.2.1".into(),
                port: Some(22),
                group_id: String::new(),
                identity_id: "login".into(),
                credentials: None,
                fingerprint: String::new(),
                os: None,
                last_connected_at: None,
            })
            .unwrap();
        let state = AppState::new(PathBuf::from("unused-test-path")).unwrap();
        *state.vault.lock().unwrap() = Some(v);
        let snapshot = serde_json::to_value(view(&state).unwrap()).unwrap();
        assert!(!snapshot
            .to_string()
            .contains("synthetic-secret-do-not-expose"));
        assert!(snapshot["hosts"][0].get("password").is_none());
        assert!(snapshot["identities"][0].get("password").is_none());
        assert_eq!(snapshot["identities"][0]["hostCount"], 1);
        assert!(
            mutate(&state, "personal", |data| data.upsert_identity(Identity {
                id: "invalid".into(),
                name: "Invalid".into(),
                username: "root".into(),
                auth: "key".into(),
                key_id: "missing-key".into(),
                password: String::new()
            }))
            .is_err()
        );
        assert_eq!(
            state
                .vault
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .data
                .identities
                .len(),
            1
        );
    }
}
