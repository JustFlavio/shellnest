use russh::{
    client,
    keys::{HashAlg, PublicKeyOrCertificate},
    Disconnect,
};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

pub(super) struct Handler {
    expected: Option<String>,
    pub(super) seen: Arc<Mutex<Option<String>>>,
}
impl client::Handler for Handler {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        let fingerprint = key.public_key().fingerprint(HashAlg::Sha256).to_string();
        if let Ok(mut seen) = self.seen.lock() {
            *seen = Some(fingerprint.clone());
        }
        Ok(self
            .expected
            .as_ref()
            .is_none_or(|expected| expected == &fingerprint))
    }
}
pub(super) fn handler(expected: Option<String>) -> Handler {
    Handler {
        expected,
        seen: Arc::new(Mutex::new(None)),
    }
}
pub(super) fn config() -> Arc<client::Config> {
    Arc::new(client::Config {
        keepalive_interval: Some(Duration::from_secs(30)),
        keepalive_max: 3,
        ..Default::default()
    })
}
pub(crate) async fn probe(address: &str, port: u16) -> Result<String, String> {
    let h = handler(None);
    let seen = h.seen.clone();
    // Probe establishes transport only. No user authentication or credentials are sent.
    let session = tokio::time::timeout(
        Duration::from_secs(15),
        client::connect(config(), (address, port), h),
    )
    .await
    .map_err(|_| "Timeout durante la verifica del server")?
    .map_err(|e| e.to_string())?;
    let _ = session
        .disconnect(Disconnect::ByApplication, "", "en")
        .await;
    let result = seen
        .lock()
        .map_err(|_| "Impronta non disponibile")?
        .clone()
        .ok_or("Impronta non disponibile".to_string());
    result
}
