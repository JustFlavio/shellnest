use super::mutate;
use crate::{
    model::{Host, HostCredentials},
    state::AppState,
    view::View,
};
use tauri::State;

#[tauri::command]
pub(crate) fn reveal_host_password(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<String, String> {
    state.host_password(&vault_id, &id)
}
#[tauri::command]
pub(crate) fn save_host(
    state: State<AppState>,
    vault_id: String,
    host: Host,
    credentials: Option<HostCredentials>,
    inherit: Option<bool>,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| {
        data.upsert_host_inheriting(host, credentials, inherit.unwrap_or(false))
    })
}
#[tauri::command]
pub(crate) fn assign_identity(
    state: State<AppState>,
    vault_id: String,
    ids: Vec<String>,
    identity_id: String,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| {
        data.assign_identity(&ids, &identity_id)
    })
}
#[tauri::command]
pub(crate) fn delete_host(
    state: State<AppState>,
    vault_id: String,
    id: String,
) -> Result<View, String> {
    mutate(&state, &vault_id, |data| {
        data.delete_host(&id);
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        commands::unlock::{open_selected, Secret},
        model::Identity,
        test_support::VaultFixture,
        view::view,
    };
    #[test]
    fn host_and_new_credentials_commit_together_without_exposing_or_overwriting_secrets() {
        let fixture = VaultFixture::new();
        let state = fixture.state();
        open_selected(
            &state,
            "personal",
            Secret::Password("test-only master password"),
            true,
        )
        .unwrap();
        let host = Host {
            id: "inline-host".into(),
            name: "API".into(),
            address: "192.0.2.20".into(),
            port: Some(22),
            group_id: String::new(),
            identity_id: String::new(),
            credentials: None,
            fingerprint: String::new(),
            os: None,
            last_connected_at: None,
        };
        let credentials = HostCredentials {
            username: " deploy ".into(),
            password: "synthetic-inline-secret".into(),
        };
        let snapshot = mutate(&state, "personal", |data| {
            data.upsert_host_inheriting(host.clone(), Some(credentials.clone()), false)
        })
        .unwrap();
        assert_eq!(snapshot.hosts.len(), 1);
        assert!(snapshot.identities.is_empty());
        assert!(snapshot.hosts[0].identity_id.is_empty());
        assert_eq!(snapshot.hosts[0].username.as_deref(), Some("deploy"));
        assert!(snapshot.hosts[0].has_password);
        assert!(!serde_json::to_string(&snapshot)
            .unwrap()
            .contains("synthetic-inline-secret"));
        let before = std::fs::read(&state.path).unwrap();
        assert_eq!(
            state.host_password("personal", "inline-host").unwrap(),
            "synthetic-inline-secret"
        );
        assert!(state.host_password("other-vault", "inline-host").is_err());
        assert!(state.host_password("personal", "missing").is_err());
        assert_eq!(std::fs::read(&state.path).unwrap(), before);
        let mut invalid = host.clone();
        invalid.name.clear();
        assert!(mutate(&state, "personal", |data| {
            data.upsert_host_inheriting(invalid, Some(credentials.clone()), false)
        })
        .is_err());
        assert_eq!(std::fs::read(&state.path).unwrap(), before);
        assert!(view(&state).unwrap().identities.is_empty());
        let mut new_host = host.clone();
        new_host.id = "another-host".into();
        assert!(mutate(&state, "personal", |data| {
            data.upsert_host_inheriting(
                new_host,
                Some(HostCredentials {
                    username: "root".into(),
                    password: String::new(),
                }),
                false,
            )
        })
        .is_err());
        assert_eq!(std::fs::read(&state.path).unwrap(), before);
        assert!(mutate(&state, "other-vault", |data| {
            data.upsert_host_inheriting(host.clone(), Some(credentials.clone()), false)
        })
        .is_err());
        let second = mutate(&state, "personal", |data| {
            data.upsert_host_inheriting(
                host,
                Some(HostCredentials {
                    username: "admin".into(),
                    password: "another-synthetic-secret".into(),
                }),
                false,
            )
        })
        .unwrap();
        assert!(second.identities.is_empty());
        let guard = state.vault.lock().unwrap();
        let data = &guard.as_ref().unwrap().data;
        assert_eq!(
            data.resolve("inline-host").unwrap().password,
            "another-synthetic-secret"
        );
        drop(guard);
        assert_eq!(
            state.host_password("personal", "inline-host").unwrap(),
            "another-synthetic-secret"
        );
        mutate(&state, "personal", |data| {
            data.upsert_identity(Identity {
                id: "shared-reveal-test".into(),
                name: "Shared".into(),
                username: "root".into(),
                auth: "password".into(),
                key_id: String::new(),
                password: "shared-secret".into(),
            })?;
            data.assign_identity(&["inline-host".into()], "shared-reveal-test")
        })
        .unwrap();
        assert!(state.host_password("personal", "inline-host").is_err());
        *state.vault.lock().unwrap() = None;
        assert!(state.host_password("personal", "inline-host").is_err());
    }
}
