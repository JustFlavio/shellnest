//! Keyboard-interactive against a real OpenSSH with PAM two-factor, from the image in
//! src-tauri/test-fixtures/pam-2fa. Ignored by default; CI runs them on Linux, and locally:
//!   docker build -t shellnest-pam-2fa src-tauri/test-fixtures/pam-2fa
//!   docker run -d --name shellnest-pam-2fa -p 127.0.0.1::22 -p 127.0.0.1::2200 shellnest-pam-2fa
//!   SHELLNEST_PAM_CONTAINER=shellnest-pam-2fa cargo test --manifest-path src-tauri/Cargo.toml pam_tests -- --ignored
use super::connection::{Question, open};
use crate::model::{Connection, Host};
use russh::keys::{Algorithm, PrivateKey};
use std::{
    process::Command,
    sync::{Arc, Mutex},
    time::Duration,
};
use zeroize::Zeroizing;

// The image's test-only credentials.
const PASSWORD: &str = "test-only-password";
const SECRET: &str = "JBSWY3DPEHPK3PXP";

fn container() -> String {
    std::env::var("SHELLNEST_PAM_CONTAINER")
        .expect("SHELLNEST_PAM_CONTAINER names the running pam-2fa container")
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
fn exec(command: &[&str]) -> String {
    let name = container();
    docker(&[&["exec", name.as_str()], command].concat())
}
fn code() -> String {
    exec(&["oathtool", "--totp", "-b", SECRET])
}

// `inner` is the container's port: 22 for password plus code, 2200 for a key plus code.
fn connection(inner: u16) -> Connection {
    let mapped = docker(&["port", &container(), &format!("{inner}/tcp")]);
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
            id: "pam".into(),
            name: "pam".into(),
            address: "127.0.0.1".into(),
            port: Some(port),
            group_id: String::new(),
            tags: vec![],
            identity_id: "pam-identity".into(),
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

// Answers each prompt the way the user would, and records which prompts were asked.
// `codes` are the one-time codes to type in turn; `None` types the current one.
fn user(
    codes: Vec<Option<&'static str>>,
    asked: Arc<Mutex<Vec<String>>>,
) -> impl FnMut(Question) -> std::future::Ready<Option<Vec<Zeroizing<String>>>> {
    let mut codes = codes.into_iter();
    move |question| {
        let Question::Prompts(challenge) = question else {
            panic!("PAM asks through keyboard-interactive, not the password method");
        };
        let answers = challenge
            .prompts
            .iter()
            .map(|prompt| {
                asked.lock().unwrap().push(prompt.text.clone());
                assert!(!prompt.echo, "{} should be hidden", prompt.text);
                Zeroizing::new(if prompt.text.contains("Verification code") {
                    codes
                        .next()
                        .expect("an unexpected code prompt")
                        .map_or_else(code, str::to_owned)
                } else {
                    PASSWORD.to_owned()
                })
            })
            .collect();
        std::future::ready(Some(answers))
    }
}

async fn connect(connection: &Connection, codes: Vec<Option<&'static str>>) -> Vec<String> {
    let asked = Arc::new(Mutex::new(Vec::new()));
    let result = tokio::time::timeout(
        Duration::from_secs(60),
        open(connection, |_| {}, user(codes, asked.clone())),
    )
    .await
    .expect("PAM container timed out");
    if let Err(error) = result {
        panic!("{error}; asked {:?}", asked.lock().unwrap());
    }
    asked.lock().unwrap().clone()
}

#[tokio::test]
#[ignore = "needs the pam-2fa container"]
async fn pam_stored_password_answers_and_the_code_is_asked() {
    let mut connection = connection(22);
    connection.password = PASSWORD.into();
    assert_eq!(
        connect(&connection, vec![None]).await,
        ["Verification code: "]
    );
}

#[tokio::test]
#[ignore = "needs the pam-2fa container"]
async fn pam_nothing_stored_asks_the_password_then_the_code() {
    assert_eq!(
        connect(&connection(22), vec![None]).await,
        ["Password: ", "Verification code: "]
    );
}

#[tokio::test]
#[ignore = "needs the pam-2fa container"]
async fn pam_a_wrong_code_starts_a_new_round() {
    let mut connection = connection(22);
    connection.password = PASSWORD.into();
    // The stored password is sent once only: the second round asks the user for it.
    assert_eq!(
        connect(&connection, vec![Some("000000"), None]).await,
        ["Verification code: ", "Password: ", "Verification code: "]
    );
}

#[tokio::test]
#[ignore = "needs the pam-2fa container"]
async fn pam_a_key_then_keyboard_interactive() {
    let key = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519).unwrap();
    let public = key.public_key().to_openssh().unwrap();
    exec(&[
        "su",
        "test",
        "-c",
        &format!(
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{public}' >> ~/.ssh/authorized_keys"
        ),
    ]);
    let mut connection = connection(2200);
    connection.auth = "key".into();
    connection.private_key = key.to_openssh(Default::default()).unwrap().to_string();
    connection.key_name = "pam".into();
    // The key is accepted in part; PAM's stack then asks for the password and the code.
    assert_eq!(
        connect(&connection, vec![None]).await,
        ["Password: ", "Verification code: "]
    );
}
