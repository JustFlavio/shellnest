//! What the UI and the session task send each other: `Input` in, `Output` out.
use super::TerminalError;
use crate::{message::Message, model::Redacted, ssh::Challenge};
use serde::Serialize;
use zeroize::Zeroizing;

pub(crate) enum Input {
    Data(Vec<u8>),
    Resize(u32, u32),
    // The answers to Output::PasswordNeeded or Output::Prompts; never logged, zeroized once used.
    Answers(Vec<Zeroizing<String>>),
    Close,
}
// Keystrokes may be a password typed into a remote prompt: only their size is ever shown.
impl std::fmt::Debug for Input {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Data(bytes) => write!(f, "Data({} bytes)", bytes.len()),
            Self::Resize(cols, rows) => write!(f, "Resize({cols}, {rows})"),
            Self::Answers(_) => f.debug_tuple("Answers").field(&Redacted).finish(),
            Self::Close => f.write_str("Close"),
        }
    }
}
#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "lowercase")]
pub(crate) enum Output {
    Data(Vec<u8>),
    // The stage the connection reached: a code, never text.
    Status(String),
    // Authentication needs a password from the user; true when the previous one was refused.
    #[serde(rename = "password")]
    PasswordNeeded(bool),
    // Keyboard-interactive: the server's prompts, answered in order.
    Prompts(Challenge),
    Error(Message),
    // One line of the connection log: a message code with parameters, never a secret.
    Log(Message),
    // The outcome of a timeline step; `warn` marks a partial result that must not look like a success.
    Detail(StepDetail),
    Metadata(ConnectionMetadata),
    Closed,
}
impl Input {
    /// The answers typed by the user, each as long as a password may be (64 KiB in all).
    pub(crate) fn answers(answers: Vec<String>) -> Result<Self, TerminalError> {
        let answers: Vec<_> = answers.into_iter().map(Zeroizing::new).collect();
        if answers.len() > 64 {
            return Err(TerminalError::InputTooLarge);
        }
        if answers.iter().any(|a| a.len() > 1024) {
            return Err(TerminalError::PasswordTooLong);
        }
        Ok(Self::Answers(answers))
    }
}
#[derive(Clone, Serialize)]
pub(crate) struct StepDetail {
    pub step: String,
    pub warn: bool,
    pub text: Message,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConnectionMetadata {
    pub os: Option<String>,
    pub last_connected_at: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn debug_output_of_input_shows_sizes_never_content() {
        assert_eq!(
            format!(
                "{:?}",
                Input::Answers(vec![Zeroizing::new("SECRET".into())])
            ),
            "Answers(<redacted>)"
        );
        assert_eq!(
            format!("{:?}", Input::Data(b"sudo-password\n".to_vec())),
            "Data(14 bytes)"
        );
        assert_eq!(format!("{:?}", Input::Resize(80, 24)), "Resize(80, 24)");
    }
    #[test]
    fn answers_are_bounded() {
        assert!(Input::answers(vec!["123456".into(), String::new()]).is_ok());
        assert!(matches!(
            Input::answers(vec!["x".repeat(1025)]),
            Err(TerminalError::PasswordTooLong)
        ));
        assert!(matches!(
            Input::answers(vec![String::new(); 65]),
            Err(TerminalError::InputTooLarge)
        ));
    }
}
