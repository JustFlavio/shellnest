use super::{Group, Host, Identity, SshKey};

pub(super) fn key(id: &str) -> SshKey {
    let secret =
        russh::keys::PrivateKey::random(&mut rand10::rng(), russh::keys::Algorithm::Ed25519)
            .unwrap();
    SshKey {
        id: id.into(),
        name: "Personal".into(),
        private_key: secret.to_openssh(Default::default()).unwrap().to_string(),
        passphrase: String::new(),
        fingerprint: String::new(),
    }
}
pub(super) fn identity(id: &str, key_id: &str, user: &str) -> Identity {
    Identity {
        id: id.into(),
        name: user.into(),
        username: user.into(),
        auth: "key".into(),
        key_id: key_id.into(),
        password: String::new(),
    }
}
pub(super) fn host(id: &str, identity_id: &str) -> Host {
    Host {
        id: id.into(),
        name: id.into(),
        address: "192.0.2.10".into(),
        port: Some(22),
        group_id: String::new(),
        identity_id: identity_id.into(),
        credentials: None,
        fingerprint: String::new(),
        os: None,
        last_connected_at: None,
    }
}
pub(super) fn group(id: &str, name: &str, parent: &str) -> Group {
    Group {
        id: id.into(),
        name: name.into(),
        parent_id: parent.into(),
        identity_id: String::new(),
        port: None,
    }
}
