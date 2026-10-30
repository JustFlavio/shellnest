use super::SftpError;
use crate::model::Connection;

/// The pane's verified destination. Resolving a saved host must still match this snapshot.
#[derive(serde::Deserialize)]
pub(crate) struct ExpectedTarget {
    address: String,
    port: u16,
    username: String,
    fingerprint: String,
}
impl ExpectedTarget {
    pub(crate) fn verify(&self, connection: &Connection) -> Result<(), SftpError> {
        if self.address != connection.host.address
            || self.port != connection.host.port.unwrap_or(22)
            || self.username != connection.username
            || self.fingerprint != connection.host.fingerprint
        {
            return Err(SftpError::DestinationChanged);
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn changed_destination_or_account_cannot_redirect_the_files_pane() {
        let mut connection = Connection {
            host: crate::model::Host {
                id: "host".into(),
                name: "server".into(),
                address: "old.example".into(),
                port: Some(2222),
                group_id: String::new(),
                tags: vec![],
                identity_id: String::new(),
                credentials: None,
                fingerprint: "known-key".into(),
                os: None,
                last_connected_at: None,
            },
            username: "deploy".into(),
            auth: "password".into(),
            password: String::new(),
            private_key: String::new(),
            passphrase: String::new(),
            key_name: String::new(),
        };
        let expected = ExpectedTarget {
            address: "old.example".into(),
            port: 2222,
            username: "deploy".into(),
            fingerprint: "known-key".into(),
        };
        assert!(expected.verify(&connection).is_ok());
        connection.host.address = "new.example".into();
        assert!(matches!(
            expected.verify(&connection),
            Err(SftpError::DestinationChanged)
        ));
        connection.host.address = "old.example".into();
        connection.username = "root".into();
        assert!(expected.verify(&connection).is_err());
        connection.username = "deploy".into();
        connection.host.port = Some(22);
        assert!(expected.verify(&connection).is_err());
        connection.host.port = Some(2222);
        connection.host.fingerprint = "different-key".into();
        assert!(expected.verify(&connection).is_err());
    }
}
