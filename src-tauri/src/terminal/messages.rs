//! What the UI and the session task send each other: `Input` in, `Output` out.
use crate::{message::Message, model::Redacted};
use serde::Serialize;
use zeroize::Zeroizing;

pub(crate) enum Input {
    Data(Vec<u8>),
    Resize(u32, u32),
    // The answer to Output::Password; never logged, zeroized once used.
    Password(Zeroizing<String>),
    Close,
}
// Keystrokes may be a password typed into a remote prompt: only their size is ever shown.
impl std::fmt::Debug for Input {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Data(bytes) => write!(f, "Data({} bytes)", bytes.len()),
            Self::Resize(cols, rows) => write!(f, "Resize({cols}, {rows})"),
            Self::Password(_) => f.debug_tuple("Password").field(&Redacted).finish(),
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
    Error(Message),
    // One line of the connection log: a message code with parameters, never a secret.
    Log(Message),
    // The outcome of a timeline step; `warn` marks a partial result that must not look like a success.
    Detail(StepDetail),
    Metadata(ConnectionMetadata),
    Closed,
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
            format!("{:?}", Input::Password(Zeroizing::new("SECRET".into()))),
            "Password(<redacted>)"
        );
        assert_eq!(
            format!("{:?}", Input::Data(b"sudo-password\n".to_vec())),
            "Data(14 bytes)"
        );
        assert_eq!(format!("{:?}", Input::Resize(80, 24)), "Resize(80, 24)");
    }
}
