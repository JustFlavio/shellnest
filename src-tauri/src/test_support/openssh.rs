//! The OpenSSH container of src-tauri/test-fixtures/openssh, for the tests marked
//! `#[ignore = "needs the openssh container"]`. CI runs them on Linux; locally:
//!   docker build -t shellnest-openssh src-tauri/test-fixtures/openssh
//!   docker run -d --name shellnest-openssh -p 127.0.0.1::22 -p 127.0.0.1::2200 -p 127.0.0.1::2201 shellnest-openssh
//!   SHELLNEST_OPENSSH_CONTAINER=shellnest-openssh cargo test --manifest-path src-tauri/Cargo.toml openssh_tests -- --ignored
use crate::model::{Connection, Host};
use std::process::Command;

/// The container's ports.
pub(crate) const PAM: u16 = 22;
pub(crate) const KEY_THEN_PAM: u16 = 2200;
pub(crate) const PLAIN: u16 = 2201;
// The image's test-only credentials.
pub(crate) const PASSWORD: &str = "test-only-password";
const SECRET: &str = "JBSWY3DPEHPK3PXP";
pub(crate) const HOME: &str = "/home/test";

fn container() -> String {
    std::env::var("SHELLNEST_OPENSSH_CONTAINER")
        .expect("SHELLNEST_OPENSSH_CONTAINER names the running openssh container")
}
fn docker(args: &[&str]) -> String {
    let output = Command::new("docker").args(args).output().unwrap();
    assert!(
        output.status.success(),
        "docker {args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap().trim().to_owned()
}
/// Runs a command in the container as root.
pub(crate) fn exec(command: &[&str]) -> String {
    let name = container();
    docker(&[&["exec", name.as_str()], command].concat())
}
/// Runs a shell script in the container as the test user.
pub(crate) fn exec_as_user(script: &str) -> String {
    exec(&["su", "test", "-c", script])
}
/// The current one-time code.
pub(crate) fn code() -> String {
    exec(&["oathtool", "--totp", "-b", SECRET])
}
/// A connection to `port` as the test user, the host key already trusted, nothing stored.
pub(crate) fn connection(port: u16) -> Connection {
    let mapped = docker(&["port", &container(), &format!("{port}/tcp")]);
    let port = mapped
        .lines()
        .next()
        .and_then(|line| line.rsplit(':').next())
        .and_then(|port| port.parse().ok())
        .expect("published port");
    let fingerprint = exec(&["ssh-keygen", "-lf", "/etc/ssh/ssh_host_ed25519_key.pub"])
        .split_whitespace()
        .nth(1)
        .expect("fingerprint")
        .to_owned();
    Connection {
        host: Host {
            id: "openssh".into(),
            name: "openssh".into(),
            address: "127.0.0.1".into(),
            port: Some(port),
            group_id: String::new(),
            tags: vec![],
            identity_id: "openssh-identity".into(),
            credentials: None,
            fingerprint,
            os: None,
            last_connected_at: None,
        },
        username: "test".into(),
        auth: "password".into(),
        password: String::new(),
        private_key: String::new(),
        passphrase: String::new(),
        key_name: String::new(),
    }
}
