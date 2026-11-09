//! Verified SSH transport and authentication, shared by shell and SFTP.
pub(crate) mod host_key;
use self::host_key::{Handler, config, handler};
use crate::error::coded;
use crate::locks::MutexExt;
use crate::message::{Message, msg};
use crate::model::Connection;
use crate::terminal::TerminalError;
pub(crate) use host_key::probe;
use russh::{
    MethodKind,
    client::{self, AuthResult, KeyboardInteractiveAuthResponse, Prompt},
    keys::{PrivateKeyWithHashAlg, decode_secret_key},
};
use std::sync::Arc;
use zeroize::Zeroizing;

/// Passwords the user may type for one connection before it is given up.
pub(crate) const MAX_PASSWORD_ATTEMPTS: usize = 3;

/// What `open` tells the UI along the way.
pub(crate) enum Note {
    Stage(&'static str),
    /// One line of the connection log: never a password, key or answer.
    Log(Message),
    /// How a step ended. `warn` is a partial result (a fallback), not a plain success.
    Detail {
        step: String,
        warn: bool,
        text: Message,
    },
}

/// What `authenticate` asks the user.
pub(crate) enum Question {
    /// A password; true when the previous one was refused.
    Password(bool),
    /// The prompts of one keyboard-interactive round.
    Prompts(Challenge),
}
/// One keyboard-interactive round, with the server's own text: shown as it is, never logged.
#[derive(Clone, serde::Serialize)]
pub(crate) struct Challenge {
    pub name: String,
    pub instructions: String,
    pub prompts: Vec<ChallengePrompt>,
    /// The previous round was refused.
    pub refused: bool,
}
#[derive(Clone, serde::Serialize)]
pub(crate) struct ChallengePrompt {
    pub text: String,
    pub echo: bool,
}

fn offers(auth: &AuthResult, method: MethodKind) -> bool {
    matches!(auth, AuthResult::Failure { remaining_methods, .. } if remaining_methods.contains(&method))
}
// Accepted, but the server wants one more method (e.g. a key, then a one-time code).
fn partial(auth: &AuthResult) -> bool {
    matches!(
        auth,
        AuthResult::Failure {
            partial_success: true,
            ..
        }
    )
}
fn methods_of(auth: &AuthResult) -> Vec<&'static str> {
    match auth {
        AuthResult::Failure {
            remaining_methods, ..
        } => remaining_methods.iter().map(<&str>::from).collect(),
        AuthResult::Success => vec![],
    }
}
// The timeline step of the n-th question (1-based).
fn password_step(n: usize) -> String {
    if n == 1 {
        "password".into()
    } else {
        format!("password-{n}")
    }
}
// Only a lone hidden prompt is taken for a password question.
fn asks_one_secret(prompts: &[Prompt]) -> bool {
    matches!(prompts, [prompt] if !prompt.echo)
}
/// Connects and authenticates. When the key or the stored password is refused (or missing), `ask`
/// is called with a `Question`: a password while the server takes passwords, otherwise the prompts
/// of keyboard-interactive. `None` means the user gave up. After `MAX_PASSWORD_ATTEMPTS` refused
/// passwords, or refused keyboard-interactive rounds, it stops asking.
pub(crate) async fn authenticate<Ask, Answer>(
    connection: &Connection,
    report: impl Fn(Note),
    mut ask: Ask,
) -> Result<client::Handle<Handler>, TerminalError>
where
    Ask: FnMut(Question) -> Answer,
    Answer: std::future::Future<Output = Option<Vec<Zeroizing<String>>>>,
{
    let host = &connection.host;
    let port = host.port.unwrap_or(22);
    let log = |message: Message| report(Note::Log(message));
    let detail = |step: &str, warn: bool, text: Message| {
        report(Note::Detail {
            step: step.into(),
            warn,
            text,
        })
    };
    report(Note::Stage("connect"));
    log(msg!(
        "log.network.resolving",
        target = format!("{}:{port}", host.address)
    ));
    match tokio::net::lookup_host((host.address.as_str(), port)).await {
        Ok(found) => {
            let list: Vec<String> = found.map(|a| a.ip().to_string()).collect();
            log(msg!("log.network.addresses", list = list.join(", ")));
        }
        Err(e) => log(msg!("log.error.resolveFailed", reason = e.to_string())),
    }
    let h = handler(Some(host.fingerprint.clone()));
    let seen = h.seen.clone();
    let info = h.info.clone();
    let mut session = client::connect(config(), (host.address.as_str(), port), h)
        .await
        .map_err(|e| {
            let found = seen.lock_recovering().clone();
            if found.as_ref().is_some_and(|f| *f != host.fingerprint) {
                log(msg!(
                    "log.error.fingerprintChanged",
                    expected = host.fingerprint.clone(),
                    received = found.unwrap_or_default()
                ));
                TerminalError::ServerKeyChanged
            } else {
                log(msg!("log.error.connectFailed", reason = e.to_string()));
                e.into()
            }
        })?;
    log(msg!("log.network.connected"));
    let server = info.lock_recovering().clone();
    if let Some(server) = &server {
        log(msg!("log.network.server", banner = server.banner.clone()));
        log(msg!(
            "log.tech.algorithms",
            kex = server.kex.clone(),
            hostKey = server.host_key.clone(),
            cipher = server.cipher.clone()
        ));
    }
    log(msg!(
        "log.fingerprint.known",
        fingerprint = host.fingerprint.clone()
    ));
    report(Note::Stage("verified"));
    report(Note::Stage("auth"));
    let is_key = connection.auth == "key";
    let mut sent_password = false;
    let mut auth = if is_key {
        let secret = decode_secret_key(
            &connection.private_key,
            if connection.passphrase.is_empty() {
                None
            } else {
                Some(&connection.passphrase)
            },
        )?;
        let algorithm = session.best_supported_rsa_hash().await?.flatten();
        log(msg!(
            "log.auth.keyAttempt",
            user = connection.username.clone()
        ));
        session
            .authenticate_publickey(
                &connection.username,
                PrivateKeyWithHashAlg::new(Arc::new(secret), algorithm),
            )
            .await
    } else {
        // Learn which methods the server takes first, like OpenSSH: under PAM two-factor a password
        // refused by the password method leaves PAM unable to finish keyboard-interactive (pam_setcred
        // fails), so the stored password goes to the password method only when it is the one offered.
        let none = session.authenticate_none(&connection.username).await?;
        if connection.password.is_empty()
            || none.success()
            || offers(&none, MethodKind::KeyboardInteractive)
            || !offers(&none, MethodKind::Password)
        {
            Ok(none)
        } else {
            sent_password = true;
            log(msg!(
                "log.auth.savedPasswordAttempt",
                user = connection.username.clone()
            ));
            session
                .authenticate_password(&connection.username, &connection.password)
                .await
        }
    }?;
    let tried_something = is_key || sent_password;
    // The stored password the password method has not judged: keyboard-interactive may take it.
    let mut stored = (!is_key
        && !sent_password
        && !connection.password.is_empty()
        && !auth.success()
        && !partial(&auth))
    .then_some(connection.password.as_str());
    if tried_something && (auth.success() || partial(&auth)) {
        log(msg!(if is_key {
            "log.success.keyAccepted"
        } else {
            "log.success.passwordAccepted"
        }));
        detail(
            "auth",
            false,
            if is_key && !connection.key_name.is_empty() {
                msg!("step.authKeyNamed", name = connection.key_name.clone())
            } else if is_key {
                msg!("step.authKey")
            } else {
                msg!("step.authPassword")
            },
        );
    } else if tried_something && stored.is_none() {
        log(msg!(if is_key {
            "log.error.keyRefused"
        } else {
            "log.error.savedPasswordRefused"
        }));
        detail(
            "auth",
            true,
            msg!(if is_key {
                "step.keyRefused"
            } else {
                "step.savedPasswordRefused"
            }),
        );
    }
    let methods_left = |auth: &AuthResult| {
        let methods = methods_of(auth);
        if !methods.is_empty() {
            log(msg!(
                if partial(auth) {
                    "log.auth.furtherRequired"
                } else {
                    "log.auth.methodsLeft"
                },
                methods = methods.join(", ")
            ));
        }
    };
    if tried_something && !auth.success() {
        methods_left(&auth);
    }
    let cancelled = || {
        log(msg!("log.error.authCancelled"));
        TerminalError::AuthCancelled
    };
    let (mut refused, mut round_refused) = (false, false);
    let (mut asked, mut sent, mut rounds) = (0, 0, 0);
    while !auth.success() {
        // Keyboard-interactive first, like OpenSSH: under PAM it can ask for a one-time code, password cannot.
        if offers(&auth, MethodKind::Password) && !offers(&auth, MethodKind::KeyboardInteractive) {
            asked += 1;
            let password = ask(Question::Password(refused))
                .await
                .ok_or_else(cancelled)?
                .into_iter()
                .next()
                .unwrap_or_default();
            refused = true;
            // Nothing to send: ask again, without bothering the server.
            if password.is_empty() {
                continue;
            }
            sent += 1;
            log(msg!(
                "log.auth.passwordAttempt",
                sent = sent,
                max = MAX_PASSWORD_ATTEMPTS
            ));
            auth = session
                .authenticate_password(&connection.username, password.as_str())
                .await?;
            let step = password_step(asked);
            if auth.success() || partial(&auth) {
                log(msg!("log.success.passwordOk"));
                detail(&step, false, msg!("step.passwordAccepted"));
                if partial(&auth) {
                    methods_left(&auth);
                }
            } else {
                log(msg!("log.error.passwordRefused"));
                detail(&step, true, msg!("step.passwordRefused"));
                if sent >= MAX_PASSWORD_ATTEMPTS {
                    let error = TerminalError::PasswordsExhausted(MAX_PASSWORD_ATTEMPTS);
                    log(coded("terminal", &error));
                    return Err(error);
                }
            }
            continue;
        }
        if !offers(&auth, MethodKind::KeyboardInteractive) {
            let error = TerminalError::AuthRefused(methods_of(&auth));
            log(coded("terminal", &error));
            return Err(error);
        }
        rounds += 1;
        log(msg!(
            "log.auth.kbdAttempt",
            sent = rounds,
            max = MAX_PASSWORD_ATTEMPTS
        ));
        let first = asked;
        let mut reply = session
            .authenticate_keyboard_interactive_start(&connection.username, None)
            .await?;
        auth = loop {
            let (name, instructions, prompts) = match reply {
                KeyboardInteractiveAuthResponse::Success => break AuthResult::Success,
                KeyboardInteractiveAuthResponse::Failure {
                    remaining_methods,
                    partial_success,
                } => {
                    break AuthResult::Failure {
                        remaining_methods,
                        partial_success,
                    };
                }
                KeyboardInteractiveAuthResponse::InfoRequest {
                    name,
                    instructions,
                    prompts,
                } => (name, instructions, prompts),
            };
            let answers = match stored {
                Some(password) if asks_one_secret(&prompts) => {
                    // Sent once only: a second hidden prompt is most likely a one-time code.
                    stored = None;
                    log(msg!("log.auth.kbdSavedPassword"));
                    vec![Zeroizing::new(password.to_owned())]
                }
                // A round without prompts only waits for an empty reply.
                _ if prompts.is_empty() => vec![],
                _ => {
                    asked += 1;
                    let challenge = Challenge {
                        name,
                        instructions,
                        prompts: prompts
                            .iter()
                            .map(|p| ChallengePrompt {
                                text: p.prompt.clone(),
                                echo: p.echo,
                            })
                            .collect(),
                        refused: std::mem::take(&mut round_refused),
                    };
                    ask(Question::Prompts(challenge))
                        .await
                        .ok_or_else(cancelled)?
                }
            };
            // russh takes plain Strings: moving them out leaves no copy behind but the one it sends.
            let mut responses: Vec<String> = answers
                .into_iter()
                .map(|mut answer| std::mem::take(&mut *answer))
                .collect();
            responses.resize(prompts.len(), String::new());
            reply = session
                .authenticate_keyboard_interactive_respond(responses)
                .await?;
        };
        let step = if asked > first {
            password_step(asked)
        } else {
            "auth".into()
        };
        if auth.success() || partial(&auth) {
            log(msg!("log.success.kbdAccepted"));
            detail(
                &step,
                false,
                msg!(if asked > first {
                    "step.kbdAccepted"
                } else {
                    "step.authKbd"
                }),
            );
            if partial(&auth) {
                methods_left(&auth);
            }
        } else {
            log(msg!("log.error.kbdRefused"));
            detail(&step, true, msg!("step.kbdRefused"));
            round_refused = true;
            if rounds >= MAX_PASSWORD_ATTEMPTS {
                let error = TerminalError::AnswersExhausted(MAX_PASSWORD_ATTEMPTS);
                log(coded("terminal", &error));
                return Err(error);
            }
        }
    }
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn password_steps_are_numbered_from_the_second_question() {
        assert_eq!(password_step(1), "password");
        assert_eq!(password_step(3), "password-3");
    }
    #[test]
    fn only_offered_methods_are_tried() {
        let refused = |methods: &[MethodKind], partial_success| AuthResult::Failure {
            remaining_methods: russh::MethodSet::from(methods),
            partial_success,
        };
        let both = refused(&[MethodKind::PublicKey, MethodKind::Password], false);
        assert!(offers(&both, MethodKind::Password));
        assert!(!offers(&both, MethodKind::KeyboardInteractive));
        assert!(!partial(&both));
        assert!(partial(&refused(&[MethodKind::KeyboardInteractive], true)));
        assert!(!offers(&AuthResult::Success, MethodKind::Password));
    }
    #[test]
    fn only_a_lone_hidden_prompt_takes_the_stored_password() {
        let prompt = |echo| Prompt {
            prompt: "Password: ".into(),
            echo,
        };
        assert!(asks_one_secret(&[prompt(false)]));
        assert!(!asks_one_secret(&[prompt(true)]));
        assert!(!asks_one_secret(&[prompt(false), prompt(false)]));
        assert!(!asks_one_secret(&[]));
    }
}
