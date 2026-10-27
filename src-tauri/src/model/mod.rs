//! The decrypted vault contents and the rules that keep them consistent.
//!
//! `Data` is the one aggregate; each submodule adds the operations of one record kind.
mod data;
mod error;
mod groups;
mod hosts;
mod identities;
mod keys;
mod migration;
mod resolve;
#[cfg(test)]
mod test_support;
mod validate;
mod workspaces;

pub(crate) use data::Data;
pub(crate) use error::ModelError;
pub(crate) use groups::{Group, MAX_GROUP_DEPTH};
pub(crate) use hosts::{Host, HostCredentials};
pub(crate) use identities::Identity;
pub(crate) use keys::SshKey;
pub(crate) use resolve::Connection;
pub(crate) use workspaces::Workspace;

/// Stands in for a secret in `Debug` output, so a stray `{:?}` or `assert_eq!` never prints it.
pub(crate) struct Redacted;
impl std::fmt::Debug for Redacted {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("<redacted>")
    }
}

pub(crate) fn new_id() -> String {
    format!("{:032x}", rand::random::<u128>())
}
pub(crate) fn validate_endpoint(address: &str, port: u16) -> Result<(), ModelError> {
    if address.trim().is_empty()
        || address.len() > 253
        || port == 0
        || address.chars().any(|c| {
            c.is_whitespace() || c.is_control() || matches!(c, '/' | '\\' | '@' | '[' | ']')
        })
    {
        return Err(ModelError::EndpointInvalid);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoints_reject_credentials_separators_and_port_zero() {
        assert!(validate_endpoint("user@host", 22).is_err());
        assert!(validate_endpoint("host\nother", 22).is_err());
        assert!(validate_endpoint("::1", 22).is_ok());
        assert!(validate_endpoint("host", 0).is_err());
    }
    #[test]
    fn debug_output_of_secret_bearing_types_never_shows_the_secret() {
        let mut data = Data::default();
        data.keys.push(SshKey {
            id: "k".into(),
            name: "Key".into(),
            private_key: "SECRET-PRIVATE-KEY".into(),
            passphrase: "SECRET-PASSPHRASE".into(),
            fingerprint: "SHA256:public".into(),
        });
        data.identities.push(Identity {
            id: "i".into(),
            name: "Login".into(),
            username: "root".into(),
            auth: "password".into(),
            key_id: String::new(),
            password: "SECRET-IDENTITY-PASSWORD".into(),
        });
        let mut host = test_support::host("h", "");
        host.credentials = Some(HostCredentials {
            username: "deploy".into(),
            password: "SECRET-HOST-PASSWORD".into(),
        });
        data.hosts.push(host);
        data.sync_token = "SECRET-SYNC-TOKEN".into();
        let connection = Connection {
            host: data.hosts[0].clone(),
            username: "deploy".into(),
            auth: "key".into(),
            password: "SECRET-HOST-PASSWORD".into(),
            private_key: "SECRET-PRIVATE-KEY".into(),
            passphrase: "SECRET-PASSPHRASE".into(),
            key_name: "Key".into(),
        };
        let shown = [
            format!("{data:?}"),
            format!("{:?}", data.keys[0]),
            format!("{:?}", data.identities[0]),
            format!("{:?}", data.hosts[0]),
            format!("{connection:?}"),
        ];
        for text in &shown {
            assert!(!text.contains("SECRET"), "leaked: {text}");
        }
        assert!(shown[1].contains("<redacted>") && shown[1].contains("SHA256:public"));
        assert!(shown[3].contains("deploy") && shown[3].contains("<redacted>"));
    }
}
