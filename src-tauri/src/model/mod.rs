//! The decrypted vault contents and the rules that keep them consistent.
//!
//! `Data` is the one aggregate; each submodule adds the operations of one record kind.
mod data;
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
pub(crate) use groups::{Group, MAX_GROUP_DEPTH};
pub(crate) use hosts::{Host, HostCredentials};
pub(crate) use identities::Identity;
pub(crate) use keys::SshKey;
pub(crate) use resolve::Connection;
pub(crate) use workspaces::Workspace;

pub(crate) fn new_id() -> String {
    format!("{:032x}", rand::random::<u128>())
}
pub(crate) fn validate_endpoint(address: &str, port: u16) -> Result<(), String> {
    if address.trim().is_empty()
        || address.len() > 253
        || port == 0
        || address.chars().any(|c| {
            c.is_whitespace() || c.is_control() || matches!(c, '/' | '\\' | '@' | '[' | ']')
        })
    {
        return Err("Indirizzo IP o nome host e porta non validi".into());
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
}
