//! Listing, transfers and file operations against OpenSSH's own sftp-server (see
//! `test_support::openssh`): rename that refuses to overwrite, real permissions, symlinks,
//! non-ASCII names and files larger than one SFTP packet.
use super::*;
use crate::sftp::{Mutation, local, session::Session};
use crate::test_support::openssh::{self, HOME, PASSWORD, PLAIN};
use russh_sftp::client::SftpSession;
use std::{
    path::PathBuf,
    sync::{Mutex, OnceLock},
    time::Duration,
};
use tokio::fs;

// The SSH transport stays alive as long as the session uses it.
struct Remote {
    _transport: russh::client::Handle<crate::ssh::host_key::Handler>,
    session: Session,
    // This test's own folder in the container's home.
    dir: String,
}
async fn remote() -> Remote {
    let mut connection = openssh::connection(PLAIN);
    connection.password = PASSWORD.into();
    let transport = crate::ssh::authenticate(&connection, |_| {}, |_| std::future::ready(None))
        .await
        .unwrap();
    let mut channel = transport.channel_open_session().await.unwrap();
    channel.request_subsystem(true, "sftp").await.unwrap();
    while !matches!(channel.wait().await, Some(russh::ChannelMsg::Success)) {}
    let client = SftpSession::new(channel.into_stream()).await.unwrap();
    let dir = format!("{HOME}/t-{}", crate::model::new_id());
    openssh::exec_as_user(&format!("mkdir '{dir}'"));
    Remote {
        _transport: transport,
        session: Session {
            client: OnceLock::from(client),
            cancel: CancellationToken::new(),
            jobs: Mutex::new(Default::default()),
            operations: tokio::sync::Mutex::new(()),
            output: tauri::ipc::Channel::new(|_| Ok(())),
        },
        dir,
    }
}
impl Remote {
    async fn copy(
        &self,
        side: Side,
        source: &str,
        destination: &str,
        conflict: Conflict,
    ) -> Result<(), SftpError> {
        let session = &self.session;
        let mut transfer = Transfer {
            session,
            token: session.cancel.child_token(),
            request: TransferRequest {
                id: crate::model::new_id(),
                side,
                source: source.into(),
                destination: destination.into(),
                conflict,
            },
            bytes: 0,
            current: String::new(),
            last: Instant::now(),
        };
        transfer.run().await
    }
    // The names in a remote folder, sorted.
    async fn names(&self, path: &str) -> Vec<String> {
        let mut names: Vec<_> = self
            .session
            .list(Side::Remote, path)
            .await
            .unwrap()
            .entries
            .into_iter()
            .map(|e| e.name)
            .collect();
        names.sort();
        names
    }
    // A file's content read by the server's own shell, not through SFTP.
    fn cat(&self, path: &str) -> String {
        openssh::exec_as_user(&format!("cat '{}/{path}'", self.dir))
    }
}
impl Drop for Remote {
    fn drop(&mut self) {
        openssh::exec(&["rm", "-rf", &self.dir]);
    }
}
fn local_dir() -> PathBuf {
    let root = std::env::temp_dir().join(format!("shellnest-openssh-{}", crate::model::new_id()));
    std::fs::create_dir_all(&root).unwrap();
    root
}
async fn within<T>(test: impl Future<Output = T>) -> T {
    tokio::time::timeout(Duration::from_secs(60), test)
        .await
        .expect("OpenSSH container timed out")
}

const UNICODE: &str = "àè 日本 😀.txt";

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn listing_shows_kinds_hidden_files_and_unicode_names() {
    within(async {
        let remote = remote().await;
        openssh::exec_as_user(&format!(
            "cd '{}' && echo a > a.txt && mkdir sub && echo h > .hidden && ln -s a.txt link \
             && echo u > '{UNICODE}' && ln -s /nowhere broken",
            remote.dir
        ));
        let listing = remote
            .session
            .list(Side::Remote, &remote.dir)
            .await
            .unwrap();
        let kind = |name: &str| {
            let entry = listing.entries.iter().find(|e| e.name == name);
            entry.map(|e| (e.kind, e.hidden))
        };
        assert_eq!(kind("a.txt"), Some(("file", false)));
        assert_eq!(kind("sub"), Some(("directory", false)));
        assert_eq!(kind(".hidden"), Some(("file", true)));
        assert_eq!(kind("link"), Some(("symlink", false)));
        assert_eq!(kind("broken"), Some(("symlink", false)));
        assert_eq!(kind(UNICODE), Some(("file", false)));
        assert_eq!(listing.parent.as_deref(), Some(HOME));
        // An empty path is the login folder.
        let home = remote.session.list(Side::Remote, "").await.unwrap();
        assert_eq!(home.path, HOME);
    })
    .await;
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn a_folder_round_trips_with_large_and_unicode_files() {
    within(async {
        let remote = remote().await;
        let root = local_dir();
        fs::create_dir_all(root.join("up/nested")).await.unwrap();
        fs::create_dir(root.join("down")).await.unwrap();
        // Several SFTP packets, and not a multiple of their size.
        let big: Vec<u8> = (0..5_000_003u32).map(|i| (i * 7 % 251) as u8).collect();
        fs::write(root.join("up/nested/big.bin"), &big)
            .await
            .unwrap();
        fs::write(root.join("up").join(UNICODE), "unicode")
            .await
            .unwrap();
        fs::write(root.join("up/empty"), b"").await.unwrap();
        let up = local::text(&root.join("up")).unwrap();
        remote
            .copy(Side::Local, &up, &remote.dir, Conflict::Ask)
            .await
            .unwrap();
        assert_eq!(
            openssh::exec_as_user(&format!("stat -c %s '{}/up/nested/big.bin'", remote.dir)),
            "5000003"
        );
        assert_eq!(remote.cat(&format!("up/{UNICODE}")), "unicode");
        // No staging file is left beside the results.
        assert_eq!(
            remote.names(&format!("{}/up", remote.dir)).await,
            ["empty", "nested", UNICODE]
        );
        let down = local::text(&root.join("down")).unwrap();
        remote
            .copy(
                Side::Remote,
                &format!("{}/up", remote.dir),
                &down,
                Conflict::Ask,
            )
            .await
            .unwrap();
        assert_eq!(
            fs::read(root.join("down/up/nested/big.bin")).await.unwrap(),
            big
        );
        assert_eq!(
            fs::read_to_string(root.join("down/up").join(UNICODE))
                .await
                .unwrap(),
            "unicode"
        );
        assert!(
            fs::read(root.join("down/up/empty"))
                .await
                .unwrap()
                .is_empty()
        );
        fs::remove_dir_all(root).await.unwrap();
    })
    .await;
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn conflicts_keep_replace_or_skip_on_a_server_whose_rename_never_overwrites() {
    within(async {
        let remote = remote().await;
        let root = local_dir();
        let file = root.join("file.txt");
        fs::write(&file, "first").await.unwrap();
        let file = local::text(&file).unwrap();
        remote
            .copy(Side::Local, &file, &remote.dir, Conflict::Ask)
            .await
            .unwrap();
        fs::write(root.join("file.txt"), "second").await.unwrap();
        assert!(matches!(
            remote
                .copy(Side::Local, &file, &remote.dir, Conflict::Ask)
                .await,
            Err(SftpError::Exists)
        ));
        remote
            .copy(Side::Local, &file, &remote.dir, Conflict::Skip)
            .await
            .unwrap();
        assert_eq!(remote.cat("file.txt"), "first");
        // OpenSSH's rename refuses an existing target: replacing goes through a backup.
        remote
            .copy(Side::Local, &file, &remote.dir, Conflict::Replace)
            .await
            .unwrap();
        assert_eq!(remote.cat("file.txt"), "second");
        remote
            .copy(Side::Local, &file, &remote.dir, Conflict::KeepBoth)
            .await
            .unwrap();
        assert_eq!(remote.cat("file (1).txt"), "second");
        assert_eq!(
            remote.names(&remote.dir).await,
            ["file (1).txt", "file.txt"]
        );
        // Downloading over a local file follows the same rules.
        let down = root.join("down");
        fs::create_dir(&down).await.unwrap();
        fs::write(down.join("file.txt"), "local").await.unwrap();
        let remote_file = format!("{}/file.txt", remote.dir);
        let down_text = local::text(&down).unwrap();
        assert!(matches!(
            remote
                .copy(Side::Remote, &remote_file, &down_text, Conflict::Ask)
                .await,
            Err(SftpError::Exists)
        ));
        remote
            .copy(Side::Remote, &remote_file, &down_text, Conflict::Replace)
            .await
            .unwrap();
        assert_eq!(
            fs::read_to_string(down.join("file.txt")).await.unwrap(),
            "second"
        );
        fs::remove_dir_all(root).await.unwrap();
    })
    .await;
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn mkdir_rename_and_delete_never_follow_a_symlink_out() {
    within(async {
        let remote = remote().await;
        let dir = remote.dir.clone();
        let session = &remote.session;
        openssh::exec_as_user(&format!(
            "cd '{dir}' && echo keep > outside.txt && echo x > taken.txt"
        ));
        session
            .mutate(
                Side::Remote,
                Mutation::Mkdir {
                    parent: dir.clone(),
                    name: "box".into(),
                },
            )
            .await
            .unwrap();
        openssh::exec_as_user(&format!(
            "cd '{dir}/box' && mkdir -p deep/er && echo y > deep/er/f && ln -s ../outside.txt link \
             && ln -s .. up"
        ));
        assert!(matches!(
            session
                .mutate(
                    Side::Remote,
                    Mutation::Rename {
                        path: format!("{dir}/box"),
                        name: "taken.txt".into(),
                    },
                )
                .await,
            Err(SftpError::Exists)
        ));
        session
            .mutate(
                Side::Remote,
                Mutation::Rename {
                    path: format!("{dir}/box"),
                    name: UNICODE.into(),
                },
            )
            .await
            .unwrap();
        session
            .mutate(
                Side::Remote,
                Mutation::Delete {
                    paths: vec![format!("{dir}/{UNICODE}")],
                },
            )
            .await
            .unwrap();
        // The links went, what they pointed at did not.
        assert_eq!(remote.names(&dir).await, ["outside.txt", "taken.txt"]);
        assert_eq!(remote.cat("outside.txt"), "keep");
    })
    .await;
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn permission_errors_are_reported_and_leave_nothing_behind() {
    within(async {
        let remote = remote().await;
        let locked = format!("{HOME}/locked");
        let readonly = format!("{HOME}/readonly");
        assert!(matches!(
            remote.session.list(Side::Remote, &locked).await,
            Err(SftpError::Protocol(_))
        ));
        assert_eq!(remote.names(&readonly).await, ["note.txt"]);
        let root = local_dir();
        fs::write(root.join("new.txt"), "new").await.unwrap();
        let file = local::text(&root.join("new.txt")).unwrap();
        assert!(
            remote
                .copy(Side::Local, &file, &readonly, Conflict::Ask)
                .await
                .is_err()
        );
        assert!(
            remote
                .session
                .mutate(
                    Side::Remote,
                    Mutation::Delete {
                        paths: vec![format!("{readonly}/note.txt")],
                    },
                )
                .await
                .is_err()
        );
        assert_eq!(remote.names(&readonly).await, ["note.txt"]);
        // A download of a folder the user cannot read fails without leaving a partial copy.
        let down = local::text(&root).unwrap();
        assert!(
            remote
                .copy(Side::Remote, &locked, &down, Conflict::Ask)
                .await
                .is_err()
        );
        let mut left = std::fs::read_dir(&root)
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect::<Vec<_>>();
        left.sort();
        assert_eq!(left, ["new.txt"]);
        fs::remove_dir_all(root).await.unwrap();
    })
    .await;
}
