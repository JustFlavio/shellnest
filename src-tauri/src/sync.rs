//! The sync client: pulls and pushes the encrypted envelope of a vault, never anything decrypted.
use crate::{
    error::Error,
    state::AppState,
    vault::{self, Disk, Envelope, OpenVault},
    view::{View, view},
};
use reqwest::{StatusCode, Url, blocking::Client};
use std::time::Duration;

/// Why the sync client refused a URL or the server refused the sync. The messages are shown to the user.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum SyncError {
    #[error("Invalid URL")]
    UrlInvalid,
    #[error("Use HTTPS; HTTP is only allowed on localhost")]
    InsecureUrl,
    #[error("URLs with credentials, a query or a fragment are not allowed")]
    UrlParts,
    #[error("Invalid remote vault identifier")]
    RemoteIdInvalid,
    #[error("For this vault use a full /vaults/<id> URL, the same on every device.")]
    VaultUrlRequired,
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Http(#[from] reqwest::Error),
    #[error("Invalid sync token")]
    Unauthorized,
    #[error(
        "Conflict: the remote vault has changed. Local data is kept; resolve the conflict before syncing."
    )]
    RemoteChanged,
    #[error("Sync failed (HTTP {0})")]
    #[serde(serialize_with = "crate::error::status_code")]
    Status(StatusCode),
    #[error("Remote revision missing")]
    RevisionMissing,
    #[error("Invalid remote vault")]
    RemoteInvalid,
    #[error(
        "Conflict: there are local changes and a different remote revision. No data was overwritten."
    )]
    LocalChanges,
    #[error("Remote vault removed: local data kept")]
    RemoteRemoved,
    #[error("The server holds a different vault")]
    DifferentVault,
    #[error("Restore is only available on a device with no local vault")]
    RestoreUnavailable,
    #[error("The token must be at least 32 characters long")]
    TokenTooShort,
}

pub(crate) fn endpoint(raw: &str) -> Result<Url, SyncError> {
    let mut url = Url::parse(raw.trim_end_matches('/')).map_err(|_| SyncError::UrlInvalid)?;
    if url.scheme() != "https"
        && !(url.scheme() == "http"
            && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")))
    {
        return Err(SyncError::InsecureUrl);
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(SyncError::UrlParts);
    }
    let path = url.path().trim_end_matches('/').to_owned();
    if let Some((_, id)) = path.rsplit_once("/vaults/") {
        if !vault::valid_vault_id(id) {
            return Err(SyncError::RemoteIdInvalid);
        }
    } else if !path.ends_with("/vault") {
        url.set_path(&format!("{path}/vault"));
    }
    Ok(url)
}
fn client() -> Result<Client, SyncError> {
    Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(Into::into)
}
pub(crate) fn endpoint_for_vault(raw: &str, vault_id: &str) -> Result<Url, SyncError> {
    let url = endpoint(raw)?;
    if vault_id != "personal" {
        let remote_id = url.path().rsplit_once("/vaults/").map(|(_, id)| id);
        if remote_id.is_none() || remote_id == Some("personal") {
            return Err(SyncError::VaultUrlRequired);
        }
    }
    Ok(url)
}
fn refused(status: StatusCode) -> SyncError {
    match status {
        StatusCode::UNAUTHORIZED => SyncError::Unauthorized,
        StatusCode::PRECONDITION_FAILED => SyncError::RemoteChanged,
        _ => SyncError::Status(status),
    }
}
fn revision(response: &reqwest::blocking::Response) -> Result<String, SyncError> {
    response
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
        .ok_or(SyncError::RevisionMissing)
}
pub(crate) fn synchronize(state: &AppState, vault_id: &str) -> Result<View, Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let path = state.active_path()?;
    let v = guard.as_mut().ok_or(Error::VaultLocked)?;
    let url = endpoint_for_vault(&v.data.sync_url, vault_id)?;
    let c = client()?;
    let response = c
        .get(url.clone())
        .bearer_auth(&v.data.sync_token)
        .send()
        .map_err(SyncError::from)?;
    let remote = if response.status() == StatusCode::NOT_FOUND {
        None
    } else {
        if !response.status().is_success() {
            return Err(refused(response.status()).into());
        }
        let rev = revision(&response)?;
        let env: Envelope = response.json().map_err(|_| SyncError::RemoteInvalid)?;
        Some((rev, env))
    };
    let remote_rev = remote.as_ref().map(|(r, _)| r.clone());
    if remote_rev != v.disk.revision {
        if v.disk.dirty {
            return Err(SyncError::LocalChanges.into());
        }
        let (rev, env) = remote.ok_or(SyncError::RemoteRemoved)?;
        if env.salt != v.disk.envelope.salt {
            return Err(SyncError::DifferentVault.into());
        }
        let mut data = vault::decrypt(&v.key, &env)?;
        // Connection settings belong to this device, even if the encrypted payload contains a copy.
        data.sync_url = v.data.sync_url.clone();
        data.sync_token = v.data.sync_token.clone();
        let migrated = data.migrated;
        let mut candidate = OpenVault {
            key: v.key.clone(),
            data,
            disk: Disk {
                envelope: env,
                revision: Some(rev),
                dirty: migrated,
            },
        };
        candidate.seal()?;
        vault::save(&path, &candidate.disk)?;
        *v = candidate;
    } else if v.disk.dirty {
        let request = c
            .put(url)
            .bearer_auth(&v.data.sync_token)
            .json(&v.disk.envelope);
        let request = if let Some(rev) = &v.disk.revision {
            request.header("If-Match", rev)
        } else {
            request.header("If-None-Match", "*")
        };
        let response = request.send().map_err(SyncError::from)?;
        if !response.status().is_success() {
            return Err(refused(response.status()).into());
        }
        let mut disk = v.disk.clone();
        disk.revision = Some(revision(&response)?);
        disk.dirty = false;
        vault::save(&path, &disk)?;
        v.disk = disk;
    }
    drop(guard);
    view(state)
}
pub(crate) fn restore(
    state: &AppState,
    vault_id: &str,
    url: &str,
    token: &str,
    password: &str,
) -> Result<View, Error> {
    let mut guard = state.vault()?;
    state.ensure_vault(vault_id)?;
    let path = state.active_path()?;
    if path.exists() || guard.is_some() {
        return Err(SyncError::RestoreUnavailable.into());
    }
    let response = client()?
        .get(endpoint_for_vault(url, vault_id)?)
        .bearer_auth(token)
        .send()
        .map_err(SyncError::from)?;
    if !response.status().is_success() {
        return Err(refused(response.status()).into());
    }
    let rev = revision(&response)?;
    let env: Envelope = response.json().map_err(|_| SyncError::RemoteInvalid)?;
    let mut v = OpenVault::unlock(
        password,
        Disk {
            envelope: env,
            revision: Some(rev),
            dirty: false,
        },
    )?;
    v.data.sync_url = url.trim_end_matches('/').into();
    v.data.sync_token = token.into();
    v.seal()?;
    vault::save(&path, &v.disk)?;
    *guard = Some(v);
    drop(guard);
    view(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model;
    use std::{
        io::{BufRead, BufReader},
        path::PathBuf,
        process::{Child, Command, Stdio},
    };
    const TOKEN: &str = "synthetic-token-for-local-integration-test-only";
    const PASSWORD: &str = "test-only master password, no real secrets";
    struct Fixture {
        child: Child,
        root: PathBuf,
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
            if self.root.parent() == Some(std::env::temp_dir().as_path())
                && self
                    .root
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("shellnest-sync-test-")
            {
                let _ = std::fs::remove_dir_all(&self.root);
            }
        }
    }
    fn state(path: PathBuf, vault: Option<OpenVault>) -> AppState {
        let state = AppState::new(path).unwrap();
        *state.vault.lock().unwrap() = vault;
        state
    }
    #[test]
    fn two_devices_upload_restore_pull_and_preserve_conflicts() {
        let root =
            std::env::temp_dir().join(format!("shellnest-sync-test-{}", rand::random::<u64>()));
        std::fs::create_dir_all(&root).unwrap();
        let module = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("sync/server.ts");
        let module_url = Url::from_file_path(module).unwrap().to_string();
        let script = format!(
            "import {{createSyncServer}} from {}; const s=await createSyncServer({{token:process.env.SYNC_TOKEN,directory:process.env.SYNC_DATA_DIR}});s.listen(0,'127.0.0.1',()=>console.log(s.address().port));",
            serde_json::to_string(&module_url).unwrap()
        );
        let child = Command::new("node")
            .args(["--input-type=module", "-e", &script])
            .env("SYNC_TOKEN", TOKEN)
            .env("SYNC_DATA_DIR", root.join("remote"))
            .stdout(Stdio::piped())
            .spawn()
            .expect("Node.js must be installed for sync integration tests");
        let mut fixture = Fixture {
            child,
            root: root.clone(),
        };
        let mut line = String::new();
        BufReader::new(fixture.child.stdout.take().unwrap())
            .read_line(&mut line)
            .unwrap();
        let port: u16 = line
            .trim()
            .parse()
            .expect("Sync service must report its port");
        let url = format!("http://127.0.0.1:{port}");
        let mut first = OpenVault::create(PASSWORD).unwrap();
        first.data.sync_url = url.clone();
        first.data.sync_token = TOKEN.into();
        let secret =
            russh::keys::PrivateKey::random(&mut rand10::rng(), russh::keys::Algorithm::Ed25519)
                .unwrap();
        first
            .data
            .upsert_key(model::SshKey {
                id: "shared-key".into(),
                name: "Personal".into(),
                private_key: secret.to_openssh(Default::default()).unwrap().to_string(),
                passphrase: String::new(),
                fingerprint: String::new(),
            })
            .unwrap();
        first
            .data
            .upsert_identity(model::Identity {
                id: "shared-identity".into(),
                name: "Deploy".into(),
                username: "deploy".into(),
                auth: "key".into(),
                key_id: "shared-key".into(),
                password: String::new(),
            })
            .unwrap();
        first.seal().unwrap();
        let a = state(root.join("a.json"), Some(first));
        let b = state(root.join("b.json"), None);
        assert!(!synchronize(&a, "personal").unwrap().dirty);
        assert!(restore(&b, "personal", &url, TOKEN, "incorrect password").is_err());
        assert!(!b.path.exists());
        assert!(
            restore(&b, "personal", &url, TOKEN, PASSWORD)
                .unwrap()
                .unlocked
        );
        let edit = |state: &AppState, name: &str| {
            let mut guard = state.vault.lock().unwrap();
            let v = guard.as_mut().unwrap();
            let mut data = v.data.clone();
            data.hosts.push(model::Host {
                id: name.into(),
                name: name.into(),
                address: "192.0.2.1".into(),
                port: Some(22),
                group_id: String::new(),
                tags: vec![],
                identity_id: "shared-identity".into(),
                credentials: None,
                fingerprint: String::new(),
                os: None,
                last_connected_at: None,
            });
            crate::state::commit(state, v, data).unwrap();
        };
        edit(&a, "first-host");
        synchronize(&a, "personal").unwrap();
        assert_eq!(synchronize(&b, "personal").unwrap().hosts.len(), 1);
        edit(&b, "second-host");
        synchronize(&b, "personal").unwrap();
        assert_eq!(synchronize(&a, "personal").unwrap().hosts.len(), 2);
        {
            let guard = a.vault.lock().unwrap();
            let data = &guard.as_ref().unwrap().data;
            assert_eq!(data.keys.len(), 1);
            assert_eq!(data.identities.len(), 1);
            assert!(
                data.hosts
                    .iter()
                    .all(|h| h.identity_id == "shared-identity")
            );
        }
        edit(&a, "offline-a");
        edit(&b, "offline-b");
        synchronize(&a, "personal").unwrap();
        let before = std::fs::read(&b.path).unwrap();
        assert!(
            synchronize(&b, "personal")
                .err()
                .unwrap()
                .to_string()
                .contains("Conflict")
        );
        assert_eq!(before, std::fs::read(&b.path).unwrap());
        assert!(
            b.vault
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .data
                .hosts
                .iter()
                .any(|h| h.id == "offline-b")
        );
        let remote = std::fs::read_to_string(root.join("remote/vault.json")).unwrap();
        assert!(!remote.contains("synthetic-password-only"));
        assert!(!remote.contains("first-host"));
    }
    #[test]
    fn remote_plaintext_and_credential_urls_are_rejected() {
        assert!(endpoint("http://example.com").is_err());
        assert!(endpoint("https://user:password@example.com").is_err());
        assert!(endpoint("https://example.com?token=secret").is_err());
        assert!(endpoint("http://127.0.0.1:8787").is_ok());
        assert_eq!(
            endpoint("https://example.com").unwrap().as_str(),
            "https://example.com/vault"
        );
        assert_eq!(
            endpoint("https://example.com/vaults/work-123")
                .unwrap()
                .as_str(),
            "https://example.com/vaults/work-123"
        );
        assert_eq!(
            endpoint("https://example.com/vault").unwrap().as_str(),
            "https://example.com/vault"
        );
        assert!(endpoint("https://example.com/vaults/INVALID").is_err());
        assert!(endpoint_for_vault("https://example.com", "work").is_err());
        assert!(endpoint_for_vault("https://example.com/vaults/personal", "work").is_err());
        assert!(endpoint_for_vault("https://example.com/vaults/remote-work", "work").is_ok());
    }
}
