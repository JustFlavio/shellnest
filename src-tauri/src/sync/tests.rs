//! End to end against the real Node server: two devices of one user and a colleague.
use super::{SyncError, members, synchronize, vaults};
use crate::{
    account::{OpenAccount, api::Role},
    commands::{
        account::{sign_out_now, signed_in},
        mutate,
        unlock::{Secret, open_selected},
    },
    error::Error,
    model::{Host, Identity, ModelError},
    state::AppState,
    view::View,
};
use reqwest::Url;
use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
};

const PASSWORD: &str = "test-only account password, no real secrets";
const SECRET: &str = "synthetic-secret-never-on-the-server";

struct Server {
    child: Child,
    root: PathBuf,
    url: String,
    invites: Vec<String>,
}
impl Drop for Server {
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
fn server() -> Server {
    let root = std::env::temp_dir().join(format!("shellnest-sync-test-{}", rand::random::<u64>()));
    std::fs::create_dir_all(&root).unwrap();
    let sync = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("sync");
    let url = |file: &str| {
        serde_json::to_string(&Url::from_file_path(sync.join(file)).unwrap().to_string()).unwrap()
    };
    let script = format!(
        "import {{createSyncServer}} from {}; import {{createInvite}} from {};
         const dir = process.env.SYNC_DATA_DIR;
         const s = await createSyncServer({{directory: dir}});
         s.listen(0, '127.0.0.1', async () => console.log(JSON.stringify({{
           port: s.address().port,
           invites: [await createInvite(dir, true), await createInvite(dir, false)],
         }})));",
        url("server.ts"),
        url("src/invite.ts"),
    );
    let mut child = Command::new("node")
        .args(["--input-type=module", "-e", &script])
        .env("SYNC_DATA_DIR", root.join("server"))
        .stdout(Stdio::piped())
        .spawn()
        .expect("Node.js must be installed for sync integration tests");
    let mut line = String::new();
    BufReader::new(child.stdout.take().unwrap())
        .read_line(&mut line)
        .unwrap();
    let started: serde_json::Value =
        serde_json::from_str(&line).expect("the server reports its port and invites");
    Server {
        url: format!("http://127.0.0.1:{}", started["port"]),
        invites: started["invites"]
            .as_array()
            .unwrap()
            .iter()
            .map(|i| i.as_str().unwrap().to_owned())
            .collect(),
        child,
        root,
    }
}
fn device(server: &Server, name: &str) -> AppState {
    let dir = server.root.join(name);
    std::fs::create_dir_all(&dir).unwrap();
    AppState::new(dir.join("vault.json")).unwrap()
}
fn login(id: &str, user: &str) -> Identity {
    Identity {
        id: id.into(),
        name: user.into(),
        username: user.into(),
        auth: "password".into(),
        key_id: String::new(),
        password: SECRET.into(),
    }
}
fn host(id: &str, identity_id: &str) -> Host {
    Host {
        id: id.into(),
        name: id.into(),
        address: "198.51.100.7".into(),
        port: Some(22),
        group_id: String::new(),
        tags: vec![],
        identity_id: identity_id.into(),
        credentials: None,
        fingerprint: String::new(),
        os: None,
        last_connected_at: None,
    }
}
fn selected(state: &AppState) -> String {
    state.catalog.lock().unwrap().selected.clone()
}
fn hosts(view: &View) -> Vec<(String, u16, String)> {
    let mut list: Vec<_> = view
        .hosts
        .iter()
        .map(|h| (h.name.clone(), h.port, h.effective_identity_id.clone()))
        .collect();
    list.sort();
    list
}
fn resolve(state: &AppState, host: &str) -> Result<String, ModelError> {
    let guard = state.vault.lock().unwrap();
    guard
        .as_ref()
        .unwrap()
        .data
        .resolve(host)
        .map(|c| c.username.clone())
}

#[test]
fn two_devices_and_a_colleague_share_a_vault_end_to_end() {
    let server = server();

    // Mario's Mac: a local vault, then an account, then the vault on the server.
    let mac = device(&server, "mac");
    open_selected(&mac, "personal", Secret::Password(PASSWORD), true).unwrap();
    mutate(&mac, "personal", |d| {
        d.upsert_identity(login("admin", "root"))?;
        d.upsert_host(host("web", "admin"))
    })
    .unwrap();
    let (account, recovery) =
        OpenAccount::register(&server.url, &server.invites[0], "mario", PASSWORD).unwrap();
    assert_eq!(recovery.split('-').count(), 8);
    signed_in(&mac, account).unwrap();
    let uploaded = vaults::upload(&mac, "personal").unwrap();
    assert!(uploaded.remote.is_some() && uploaded.vaults[0].remote);
    assert!(mac.path.with_extension("pre-server.bak").exists());

    // Mario's Windows PC: address, username and password, and everything is there.
    let pc = device(&server, "pc");
    assert!(matches!(
        OpenAccount::login(&server.url, "mario", "wrong password, sorry"),
        Err(SyncError::WrongLogin)
    ));
    let view = signed_in(
        &pc,
        OpenAccount::login(&server.url, "mario", PASSWORD).unwrap(),
    )
    .unwrap();
    let shared_id = selected(&pc);
    assert!(view.unlocked);
    assert_eq!(hosts(&view), vec![("web".into(), 22, "admin".into())]);
    assert_eq!(resolve(&pc, "web").unwrap(), "root");

    // Both change the same host and the PC adds one: every change survives.
    mutate(&mac, "personal", |d| {
        let mut web = d.hosts[0].clone();
        web.name = "Web".into();
        d.upsert_host(web)
    })
    .unwrap();
    mutate(&pc, &shared_id, |d| {
        let mut web = d.hosts[0].clone();
        web.port = Some(2222);
        d.upsert_host(web)?;
        d.upsert_host(host("db", "admin"))
    })
    .unwrap();
    synchronize(&mac, "personal").unwrap();
    synchronize(&pc, &shared_id).unwrap();
    let mac_view = synchronize(&mac, "personal").unwrap();
    let pc_view = synchronize(&pc, &shared_id).unwrap();
    let expected = vec![
        ("Web".into(), 2222, "admin".into()),
        ("db".into(), 22, "admin".into()),
    ];
    assert_eq!(hosts(&mac_view), expected);
    assert_eq!(hosts(&pc_view), expected);
    assert!(!mac_view.dirty && !pc_view.dirty);

    // Anna joins as a viewer: she sees the servers, not Mario's credentials.
    let anna = device(&server, "anna");
    let (account, _) =
        OpenAccount::register(&server.url, &server.invites[1], "anna", PASSWORD).unwrap();
    signed_in(&anna, account).unwrap();
    let list = members::add(&mac, "personal", "anna", Role::Viewer).unwrap();
    assert_eq!(list.len(), 2);
    vaults::receive(&anna).unwrap();
    let anna_id = anna
        .catalog
        .lock()
        .unwrap()
        .vaults
        .iter()
        .find(|e| e.remote.is_some())
        .unwrap()
        .id
        .clone();
    crate::commands::vaults::select(&anna, &anna_id).unwrap();
    let view = open_selected(&anna, &anna_id, Secret::Account, false).unwrap();
    assert_eq!(view.hosts.len(), 2);
    assert!(view.identities.is_empty());
    assert!(matches!(
        members::add(&anna, &anna_id, "mario", Role::Editor),
        Err(Error::Sync(SyncError::NotAllowed))
    ));
    assert!(matches!(
        resolve(&anna, "web"),
        Err(ModelError::HostWithoutIdentity(_))
    ));
    let refused = mutate(&anna, &anna_id, |d| {
        let mut web = d.hosts[0].clone();
        web.name = "Renamed by a viewer".into();
        d.upsert_host(web)
    });
    assert!(matches!(refused, Err(Error::Model(ModelError::ReadOnly))));
    // Her own credentials are hers: allowed, and private.
    mutate(&anna, &anna_id, |d| {
        d.upsert_identity(login("anna-own", "anna"))?;
        d.assign_identity(&["web".into(), "db".into()], "anna-own")
    })
    .unwrap();
    synchronize(&anna, &anna_id).unwrap();
    assert_eq!(resolve(&anna, "web").unwrap(), "anna");
    let mac_view = synchronize(&mac, "personal").unwrap();
    assert_eq!(hosts(&mac_view), expected);
    assert!(mac_view.identities.iter().all(|i| i.id != "anna-own"));

    // An editor shares an identity: from then on Anna can use it too.
    members::share_identity(&mac, "personal", "admin").unwrap();
    synchronize(&mac, "personal").unwrap();
    let view = synchronize(&anna, &anna_id).unwrap();
    assert!(view.identities.iter().any(|i| i.id == "admin" && i.shared));

    // Removing Anna replaces the key; she keeps her copy but gets nothing new.
    let anna_user = members::members(&mac, "personal")
        .unwrap()
        .into_iter()
        .find(|m| m.username == "anna")
        .unwrap();
    let removal = members::remove(&mac, "personal", &anna_user.user_id).unwrap();
    assert_eq!(removal.members.len(), 1);
    assert_eq!(removal.exposed, vec!["root".to_string()]);
    assert!(matches!(
        synchronize(&anna, &anna_id),
        Err(Error::Sync(SyncError::AccessRevoked))
    ));
    // The PC picks up the new key and keeps syncing.
    mutate(&pc, &shared_id, |d| d.upsert_host(host("cache", "admin"))).unwrap();
    synchronize(&pc, &shared_id).unwrap();
    assert_eq!(synchronize(&mac, "personal").unwrap().hosts.len(), 3);

    // Mario changes the password on the Mac while the PC is locked: the new one opens the PC.
    const NEW_PASSWORD: &str = "test-only new password, after the change";
    const NEWER_PASSWORD: &str = "test-only newer password, changed again";
    mac.account()
        .unwrap()
        .as_mut()
        .unwrap()
        .change_password(PASSWORD, NEW_PASSWORD)
        .unwrap();
    let lock = |state: &AppState| {
        *state.vault.lock().unwrap() = None;
        *state.account().unwrap() = None;
    };
    lock(&pc);
    open_selected(&pc, &shared_id, Secret::Password(NEW_PASSWORD), false).unwrap();
    lock(&pc);
    assert!(open_selected(&pc, &shared_id, Secret::Password(PASSWORD), false).is_err());
    open_selected(&pc, &shared_id, Secret::Password(NEW_PASSWORD), false).unwrap();

    // Changed again on the PC: the Mac, unlocked, takes it at its next sync.
    pc.account()
        .unwrap()
        .as_mut()
        .unwrap()
        .change_password(NEW_PASSWORD, NEWER_PASSWORD)
        .unwrap();
    synchronize(&mac, "personal").unwrap();
    let file = crate::account::load(&mac.path).unwrap().unwrap();
    assert!(OpenAccount::unlock(file.clone(), NEW_PASSWORD).is_err());
    assert!(OpenAccount::unlock(file, NEWER_PASSWORD).is_ok());

    // The server never saw a secret, an address or a name in clear.
    for entry in walk(&server.root.join("server")) {
        let text = String::from_utf8_lossy(&std::fs::read(&entry).unwrap()).into_owned();
        // Only strings with a character outside base64, so ciphertext cannot contain them by chance.
        for clear in [SECRET, "198.51.100.7", "anna-own"] {
            assert!(!text.contains(clear), "{clear} in {}", entry.display());
        }
    }

    // Signing out with nothing unsent removes the server vaults from the device.
    let view = sign_out_now(&pc).unwrap();
    assert!(view.account.is_none());
    assert!(view.vaults.iter().all(|v| !v.remote));
}

fn walk(dir: &std::path::Path) -> Vec<PathBuf> {
    let mut files = vec![];
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            files.extend(walk(&path));
        } else {
            files.push(path);
        }
    }
    files
}
