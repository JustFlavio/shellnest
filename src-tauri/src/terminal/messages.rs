use serde::Serialize;
use zeroize::Zeroizing;

pub(crate) enum Input {
    Data(Vec<u8>),
    Resize(u32, u32),
    // The answer to Output::Password; never logged, zeroized once used.
    Password(Zeroizing<String>),
    Close,
}
#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "lowercase")]
pub(crate) enum Output {
    Data(Vec<u8>),
    Status(String),
    // Authentication needs a password from the user; true when the previous one was refused.
    #[serde(rename = "password")]
    PasswordNeeded(bool),
    Error(String),
    // One line of the connection log: plain text, never a secret.
    Log(String),
    // The outcome of a timeline step; `warn` marks a partial result that must not look like a success.
    Detail(StepDetail),
    Metadata(ConnectionMetadata),
    Closed,
}
#[derive(Clone, Serialize)]
pub(crate) struct StepDetail {
    pub step: String,
    pub warn: bool,
    pub text: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConnectionMetadata {
    pub os: Option<String>,
    pub last_connected_at: u64,
}
