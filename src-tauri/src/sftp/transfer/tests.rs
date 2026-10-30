use super::*;
use crate::sftp::{
    Mutation,
    test_server::{Fixture, Node},
};
use std::{
    sync::{Mutex, OnceLock, atomic::Ordering},
    time::Duration,
};
use tokio::fs;

async fn session(fixture: &Fixture) -> Session {
    Session {
        client: OnceLock::from(fixture.connect().await),
        cancel: CancellationToken::new(),
        jobs: Mutex::new(Default::default()),
        operations: tokio::sync::Mutex::new(()),
        output: tauri::ipc::Channel::new(|_| Ok(())),
    }
}
async fn copy(
    session: &Session,
    side: Side,
    source: &str,
    destination: &str,
    conflict: Conflict,
) -> Result<(), SftpError> {
    let request = TransferRequest {
        id: crate::model::new_id(),
        side,
        source: source.into(),
        destination: destination.into(),
        conflict,
    };
    let mut transfer = Transfer {
        session,
        token: session.cancel.child_token(),
        request,
        bytes: 0,
        current: String::new(),
        last: Instant::now(),
    };
    transfer.run().await
}
#[tokio::test]
async fn folders_round_trip_over_sftp_and_conflicts_preserve_originals() {
    tokio::time::timeout(Duration::from_secs(30), async {
        let fixture = Fixture::default();
        let session = session(&fixture).await;
        let root = std::env::temp_dir().join(format!("shellnest-sftp-{}", crate::model::new_id()));
        fs::create_dir_all(root.join("source/nested"))
            .await
            .unwrap();
        fs::create_dir(root.join("download")).await.unwrap();
        let data = vec![0x5a; 300_000];
        fs::write(root.join("source/nested/file.bin"), &data)
            .await
            .unwrap();
        fs::write(root.join("source/.hidden"), b"hidden")
            .await
            .unwrap();
        let source = local::text(&root.join("source")).unwrap();
        copy(&session, Side::Local, &source, "/", Conflict::Ask)
            .await
            .unwrap();
        assert_eq!(fixture.bytes("/source/nested/file.bin"), data);
        let remote = session.list(Side::Remote, "/source").await.unwrap();
        assert!(
            remote
                .entries
                .iter()
                .any(|e| e.name == ".hidden" && e.hidden)
        );
        fs::write(root.join("source/nested/file.bin"), b"changed")
            .await
            .unwrap();
        assert!(matches!(
            copy(&session, Side::Local, &source, "/", Conflict::Ask).await,
            Err(SftpError::Exists)
        ));
        assert_eq!(fixture.bytes("/source/nested/file.bin"), data);
        copy(&session, Side::Local, &source, "/", Conflict::Skip)
            .await
            .unwrap();
        assert_eq!(fixture.bytes("/source/nested/file.bin"), data);
        copy(&session, Side::Local, &source, "/", Conflict::Replace)
            .await
            .unwrap();
        assert_eq!(fixture.bytes("/source/nested/file.bin"), b"changed");
        copy(&session, Side::Local, &source, "/", Conflict::KeepBoth)
            .await
            .unwrap();
        assert_eq!(fixture.bytes("/source (1)/nested/file.bin"), b"changed");
        let download = local::text(&root.join("download")).unwrap();
        copy(&session, Side::Remote, "/source", &download, Conflict::Ask)
            .await
            .unwrap();
        assert_eq!(
            fs::read(root.join("download/source/nested/file.bin"))
                .await
                .unwrap(),
            b"changed"
        );
        session
            .mutate(
                Side::Remote,
                Mutation::Delete {
                    paths: vec!["/source (1)".into()],
                },
            )
            .await
            .unwrap();
        assert!(!fixture.nodes.lock_recovering().contains_key("/source (1)"));
        fs::remove_dir_all(root).await.unwrap();
    })
    .await
    .expect("SFTP transfer fixture timed out");
}
#[tokio::test]
async fn failed_publication_restores_the_original_or_reports_its_backup() {
    let fixture = Fixture::default();
    let session = session(&fixture).await;
    let root = std::env::temp_dir().join(format!("shellnest-restore-{}", crate::model::new_id()));
    fs::create_dir(&root).await.unwrap();
    fs::write(root.join("file"), b"new").await.unwrap();
    let source = local::text(&root.join("file")).unwrap();
    fixture
        .nodes
        .lock_recovering()
        .insert("/file".into(), Node::File(b"original".to_vec()));
    fixture.fail_publication.store(1, Ordering::SeqCst);
    assert!(
        copy(&session, Side::Local, &source, "/", Conflict::Replace)
            .await
            .is_err()
    );
    assert_eq!(fixture.bytes("/file"), b"original");
    fixture.fail_publication.store(2, Ordering::SeqCst);
    let error = copy(&session, Side::Local, &source, "/", Conflict::Replace)
        .await
        .unwrap_err();
    let SftpError::Recovery(path) = error else {
        panic!("expected backup recovery location");
    };
    assert_eq!(fixture.bytes(&path), b"original");
    fs::remove_dir_all(root).await.unwrap();
}
#[tokio::test]
async fn cancellation_during_upload_cleans_staging_and_never_truncates_destination() {
    let fixture = Fixture {
        delay_write: true,
        ..Default::default()
    };
    let session = session(&fixture).await;
    let root = std::env::temp_dir().join(format!("shellnest-cancel-{}", crate::model::new_id()));
    fs::create_dir(&root).await.unwrap();
    fs::write(root.join("file"), vec![1; 2_000_000])
        .await
        .unwrap();
    fixture
        .nodes
        .lock_recovering()
        .insert("/file".into(), Node::File(b"original".to_vec()));
    let source = local::text(&root.join("file")).unwrap();
    let (result, ()) = tokio::join!(
        copy(&session, Side::Local, &source, "/", Conflict::Replace),
        async {
            fixture.wrote.notified().await;
            session.cancel.cancel();
        }
    );
    assert!(matches!(result, Err(SftpError::Cancelled)));
    assert_eq!(fixture.bytes("/file"), b"original");
    assert!(
        !fixture
            .nodes
            .lock_recovering()
            .keys()
            .any(|p| p.ends_with(".part"))
    );
    fs::remove_dir_all(root).await.unwrap();
}
