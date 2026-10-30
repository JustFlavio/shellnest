//! SSH sessions: host key probing, authentication, and the session loop that pumps a channel.
mod connection;
mod error;
mod messages;
mod os_probe;
mod password;
mod session;
#[cfg(test)]
mod test_server;

pub(crate) use crate::ssh::probe;
pub(crate) use error::TerminalError;
pub(crate) use messages::{Input, Output};
pub(crate) use session::{register, send, session_scope};

pub(crate) use password::PasswordPrompt;
pub(crate) use session::until_open;
