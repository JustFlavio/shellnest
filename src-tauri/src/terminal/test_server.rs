//! An in-process SSH server for the connection tests: password and key login, an echoing shell
//! and a fixed `os-release` reply.
use super::os_probe::OS_PROBE;
use crate::model::{Connection, Host};
use russh::{
    ChannelId, MethodKind, MethodSet,
    keys::{Algorithm, HashAlg, PrivateKey, PublicKey},
    server,
};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    time::Duration,
};

#[derive(Clone)]
pub(super) struct Echo {
    pub(super) key: PublicKey,
    pub(super) attempts: Arc<AtomicUsize>,
    pub(super) allow_shell: Arc<AtomicBool>,
    // What a refusal keeps offering, like a real server (the default would drop the method just tried).
    pub(super) offered: MethodSet,
}
impl Echo {
    fn refuse(&self) -> server::Auth {
        server::Auth::Reject {
            proceed_with_methods: Some(self.offered.clone()),
            partial_success: false,
        }
    }
}
impl server::Handler for Echo {
    type Error = russh::Error;
    async fn auth_password(
        &mut self,
        user: &str,
        password: &str,
    ) -> Result<server::Auth, Self::Error> {
        self.attempts.fetch_add(1, Ordering::SeqCst);
        Ok(if user == "test" && password == "test-only-password" {
            server::Auth::Accept
        } else {
            self.refuse()
        })
    }
    async fn auth_publickey(
        &mut self,
        user: &str,
        key: server::VerifiedPublicKey<'_>,
    ) -> Result<server::Auth, Self::Error> {
        self.attempts.fetch_add(1, Ordering::SeqCst);
        Ok(if user == "test" && key.public_key == &self.key {
            server::Auth::Accept
        } else {
            self.refuse()
        })
    }
    async fn channel_open_session(
        &mut self,
        _: russh::Channel<server::Msg>,
        reply: server::ChannelOpenHandle,
        _: &mut server::Session,
    ) -> Result<(), Self::Error> {
        reply.accept().await;
        Ok(())
    }
    async fn pty_request(
        &mut self,
        id: ChannelId,
        _: &str,
        _: u32,
        _: u32,
        _: u32,
        _: u32,
        _: &[(russh::Pty, u32)],
        session: &mut server::Session,
    ) -> Result<(), Self::Error> {
        session.channel_success(id)?;
        Ok(())
    }
    async fn shell_request(
        &mut self,
        id: ChannelId,
        session: &mut server::Session,
    ) -> Result<(), Self::Error> {
        if !self.allow_shell.load(Ordering::SeqCst) {
            session.channel_failure(id)?;
            return Ok(());
        }
        session.data(id, b"fixture login banner\r\n".to_vec())?;
        session.channel_success(id)?;
        Ok(())
    }
    async fn data(
        &mut self,
        id: ChannelId,
        bytes: &[u8],
        session: &mut server::Session,
    ) -> Result<(), Self::Error> {
        session.data(id, bytes.to_vec())?;
        Ok(())
    }
    async fn exec_request(
        &mut self,
        id: ChannelId,
        command: &[u8],
        session: &mut server::Session,
    ) -> Result<(), Self::Error> {
        assert_eq!(command, OS_PROBE.as_bytes());
        session.channel_success(id)?;
        session.data(id, b"NAME=Ubuntu\nID=ubuntu\n".to_vec())?;
        session.eof(id)?;
        session.close(id)?;
        Ok(())
    }
}
pub(super) async fn fixture(password_ok: bool) -> (Connection, tokio::task::JoinHandle<()>) {
    let key = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519).unwrap();
    let server_key = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519).unwrap();
    let fingerprint = server_key
        .public_key()
        .fingerprint(HashAlg::Sha256)
        .to_string();
    let echo = Echo {
        key: key.public_key().clone(),
        attempts: Arc::new(AtomicUsize::new(0)),
        allow_shell: Arc::new(AtomicBool::new(true)),
        offered: if password_ok {
            MethodSet::from(&[MethodKind::Password, MethodKind::PublicKey][..])
        } else {
            MethodSet::from(&[MethodKind::PublicKey][..])
        },
    };
    let config = Arc::new(server::Config {
        keys: vec![server_key],
        auth_rejection_time: Duration::ZERO,
        methods: if password_ok {
            MethodSet::from(&[MethodKind::Password, MethodKind::PublicKey][..])
        } else {
            MethodSet::from(&[MethodKind::PublicKey][..])
        },
        ..Default::default()
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let task = tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            let (config, echo) = (config.clone(), echo.clone());
            tokio::spawn(async move {
                if let Ok(session) = server::run_stream(config, socket, echo).await {
                    let _ = session.await;
                }
            });
        }
    });
    let connection = Connection {
        host: Host {
            id: "test".into(),
            name: "test".into(),
            address: "127.0.0.1".into(),
            port: Some(port),
            group_id: String::new(),
            tags: vec![],
            identity_id: "test-identity".into(),
            credentials: None,
            fingerprint,
            os: None,
            last_connected_at: None,
        },
        username: "test".into(),
        auth: "key".into(),
        password: String::new(),
        private_key: PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519)
            .unwrap()
            .to_openssh(Default::default())
            .unwrap()
            .to_string(),
        passphrase: String::new(),
        key_name: "chiave di prova".into(),
    };
    (connection, task)
}
