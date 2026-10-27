use super::TerminalError;
use crate::locks::MutexExt;
use russh::{
    client,
    keys::{HashAlg, PublicKeyOrCertificate},
    Disconnect, Names,
};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

/// What the server announced during the key exchange, for the connection log.
#[derive(Clone)]
pub(super) struct ServerInfo {
    pub(super) banner: String,
    pub(super) algorithms: String,
}
pub(super) struct Handler {
    expected: Option<String>,
    pub(super) seen: Arc<Mutex<Option<String>>>,
    pub(super) info: Arc<Mutex<Option<ServerInfo>>>,
}
// The identification string comes from the server: keep it to one printable, bounded line.
fn printable(raw: &[u8]) -> String {
    String::from_utf8_lossy(raw)
        .chars()
        .filter(|c| !c.is_control())
        .take(200)
        .collect()
}
impl client::Handler for Handler {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        let fingerprint = key.public_key().fingerprint(HashAlg::Sha256).to_string();
        *self.seen.lock_recovering() = Some(fingerprint.clone());
        Ok(self
            .expected
            .as_ref()
            .is_none_or(|expected| expected == &fingerprint))
    }
    async fn kex_done(
        &mut self,
        _: Option<&[u8]>,
        names: &Names,
        session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        // Only the first exchange is of interest; later ones are rekeys.
        self.info
            .lock_recovering()
            .get_or_insert_with(|| ServerInfo {
                banner: printable(session.remote_sshid()),
                algorithms: format!(
                    "scambio chiavi {}, chiave host {}, cifrario {}",
                    names.kex.as_ref(),
                    names.key,
                    names.cipher.as_ref()
                ),
            });
        Ok(())
    }
}
pub(super) fn handler(expected: Option<String>) -> Handler {
    Handler {
        expected,
        seen: Arc::new(Mutex::new(None)),
        info: Arc::new(Mutex::new(None)),
    }
}
pub(super) fn config() -> Arc<client::Config> {
    Arc::new(client::Config {
        keepalive_interval: Some(Duration::from_secs(30)),
        keepalive_max: 3,
        ..Default::default()
    })
}
pub(crate) async fn probe(address: &str, port: u16) -> Result<String, TerminalError> {
    let h = handler(None);
    let seen = h.seen.clone();
    // Probe establishes transport only. No user authentication or credentials are sent.
    let session = tokio::time::timeout(
        Duration::from_secs(15),
        client::connect(config(), (address, port), h),
    )
    .await
    .map_err(|_| TerminalError::ProbeTimeout)??;
    let _ = session
        .disconnect(Disconnect::ByApplication, "", "en")
        .await;
    let fingerprint = seen.lock_recovering().clone();
    fingerprint.ok_or(TerminalError::FingerprintUnavailable)
}
