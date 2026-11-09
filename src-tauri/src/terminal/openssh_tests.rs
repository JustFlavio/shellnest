//! Authentication and the shell against a real OpenSSH (see `test_support::openssh`): PAM two-factor
//! through keyboard-interactive, and a plain password login with a PTY shell and the OS probe.
use super::connection::{Question, open};
use super::os_probe::detect_os;
use crate::model::Connection;
use crate::test_support::openssh::{self, KEY_THEN_PAM, PAM, PASSWORD, PLAIN};
use russh::{
    ChannelMsg,
    keys::{Algorithm, PrivateKey},
};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use zeroize::Zeroizing;

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
                        .map_or_else(openssh::code, str::to_owned)
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
    .expect("OpenSSH container timed out");
    if let Err(error) = result {
        panic!("{error}; asked {:?}", asked.lock().unwrap());
    }
    asked.lock().unwrap().clone()
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn pam_stored_password_answers_and_the_code_is_asked() {
    let mut connection = openssh::connection(PAM);
    connection.password = PASSWORD.into();
    assert_eq!(
        connect(&connection, vec![None]).await,
        ["Verification code: "]
    );
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn pam_nothing_stored_asks_the_password_then_the_code() {
    assert_eq!(
        connect(&openssh::connection(PAM), vec![None]).await,
        ["Password: ", "Verification code: "]
    );
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn pam_a_wrong_code_starts_a_new_round() {
    let mut connection = openssh::connection(PAM);
    connection.password = PASSWORD.into();
    // The stored password is sent once only: the second round asks the user for it.
    assert_eq!(
        connect(&connection, vec![Some("000000"), None]).await,
        ["Verification code: ", "Password: ", "Verification code: "]
    );
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn pam_a_key_then_keyboard_interactive() {
    let key = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519).unwrap();
    let public = key.public_key().to_openssh().unwrap();
    openssh::exec_as_user(&format!(
        "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{public}' >> ~/.ssh/authorized_keys"
    ));
    let mut connection = openssh::connection(KEY_THEN_PAM);
    connection.auth = "key".into();
    connection.private_key = key.to_openssh(Default::default()).unwrap().to_string();
    connection.key_name = "openssh".into();
    // The key is accepted in part; PAM's stack then asks for the password and the code.
    assert_eq!(
        connect(&connection, vec![None]).await,
        ["Password: ", "Verification code: "]
    );
}

#[tokio::test]
#[ignore = "needs the openssh container"]
async fn a_password_login_opens_a_shell_that_runs_commands() {
    tokio::time::timeout(Duration::from_secs(60), async {
        let mut connection = openssh::connection(PLAIN);
        connection.password = PASSWORD.into();
        let ask = |_: Question| std::future::ready(None);
        let (session, channel, _) = open(&connection, |_| {}, ask).await.unwrap();
        assert_eq!(detect_os(&session).await.as_deref(), Some("ubuntu"));
        // The shell expands the sum, so the echo of the typed line alone never matches.
        channel
            .data(&b"echo shellnest-$((40 + 2)) $TERM\n"[..])
            .await
            .unwrap();
        let (mut channel, mut output) = (channel, String::new());
        while !output.contains("shellnest-42 xterm-256color") {
            match channel.wait().await {
                Some(ChannelMsg::Data { data }) => output.push_str(&String::from_utf8_lossy(&data)),
                Some(ChannelMsg::Eof | ChannelMsg::Close) | None => {
                    panic!("shell closed: {output}")
                }
                _ => {}
            }
        }
    })
    .await
    .expect("OpenSSH container timed out");
}
