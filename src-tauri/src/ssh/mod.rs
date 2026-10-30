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
    MethodKind, MethodSet,
    client::{self, AuthResult},
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

// Only a server that still offers passwords can be asked for one.
fn accepts_password(auth: &AuthResult) -> bool {
    matches!(auth, AuthResult::Failure { remaining_methods, .. } if remaining_methods.contains(&MethodKind::Password))
}
fn methods_of(auth: &AuthResult) -> Vec<&'static str> {
    match auth {
        AuthResult::Failure {
            remaining_methods, ..
        } => remaining_methods.iter().map(<&str>::from).collect(),
        AuthResult::Success => vec![],
    }
}
// The timeline step of the n-th password question (1-based).
fn password_step(n: usize) -> String {
    if n == 1 {
        "password".into()
    } else {
        format!("password-{n}")
    }
}
/// Connects and authenticates. When the key or the stored password is refused (or missing), `ask`
/// is called with whether a typed password was already refused; `None` means the user gave up.
/// After `MAX_PASSWORD_ATTEMPTS` refused passwords it stops asking.
pub(crate) async fn authenticate<Ask, Answer>(
    connection: &Connection,
    report: impl Fn(Note),
    mut ask: Ask,
) -> Result<client::Handle<Handler>, TerminalError>
where
    Ask: FnMut(bool) -> Answer,
    Answer: std::future::Future<Output = Option<Zeroizing<String>>>,
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
    } else if connection.password.is_empty() {
        // Nothing stored to try: go straight to asking.
        Ok(AuthResult::Failure {
            remaining_methods: MethodSet::from(&[MethodKind::Password][..]),
            partial_success: false,
        })
    } else {
        log(msg!(
            "log.auth.savedPasswordAttempt",
            user = connection.username.clone()
        ));
        session
            .authenticate_password(&connection.username, &connection.password)
            .await
    }?;
    let tried_something = is_key || !connection.password.is_empty();
    if auth.success() {
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
    } else if tried_something {
        log(msg!(if is_key {
            "log.error.keyRefused"
        } else {
            "log.error.savedPasswordRefused"
        }));
        let methods = methods_of(&auth);
        if !methods.is_empty() {
            log(msg!("log.auth.methodsLeft", methods = methods.join(", ")));
        }
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
    let mut refused = false;
    let (mut asked, mut sent) = (0, 0);
    while !auth.success() {
        if !accepts_password(&auth) {
            let error = TerminalError::AuthRefused(methods_of(&auth));
            log(coded("terminal", &error));
            return Err(error);
        }
        asked += 1;
        let password = ask(refused).await.ok_or_else(|| {
            log(msg!("log.error.authCancelled"));
            TerminalError::AuthCancelled
        })?;
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
        if auth.success() {
            log(msg!("log.success.passwordOk"));
            detail(&step, false, msg!("step.passwordAccepted"));
        } else {
            log(msg!("log.error.passwordRefused"));
            detail(&step, true, msg!("step.passwordRefused"));
            if sent >= MAX_PASSWORD_ATTEMPTS {
                let error = TerminalError::PasswordsExhausted(MAX_PASSWORD_ATTEMPTS);
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
    fn only_a_refusal_that_offers_passwords_prompts() {
        let refused = |methods: &[MethodKind]| AuthResult::Failure {
            remaining_methods: MethodSet::from(methods),
            partial_success: false,
        };
        assert!(accepts_password(&refused(&[
            MethodKind::PublicKey,
            MethodKind::Password
        ])));
        assert!(!accepts_password(&refused(&[MethodKind::PublicKey])));
        assert!(!accepts_password(&AuthResult::Success));
    }
}
