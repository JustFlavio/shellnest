//! Errors of SSH sessions, host key probing and the local PTY.
/// Why a terminal session, a local PTY or a host key check failed. The messages are shown to the user.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum TerminalError {
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Ssh(#[from] russh::Error),
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Key(#[from] russh::keys::Error),
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Io(#[from] std::io::Error),
    // The PTY library reports opaque errors; only their text is kept.
    #[error("{0}")]
    Pty(String),
    #[cfg(unix)]
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Errno(#[from] nix::errno::Errno),
    #[cfg(unix)]
    #[error("Local PTY without a native descriptor")]
    NoPtyDescriptor,
    #[error("Timed out while checking the server")]
    ProbeTimeout,
    #[error("Fingerprint not available")]
    FingerprintUnavailable,
    #[error("SSH connection timed out")]
    ConnectTimeout,
    #[error(
        "The server identity has changed. Connection blocked: check the new fingerprint outside the app."
    )]
    ServerKeyChanged,
    #[error("{}", refusal_text(.0))]
    #[serde(serialize_with = "refusal")]
    AuthRefused(Vec<&'static str>),
    #[error("Authentication cancelled")]
    AuthCancelled,
    #[error("Password not accepted after {0} attempts.")]
    PasswordsExhausted(usize),
    #[error("Initial server response too large")]
    InitialOutputTooLarge,
    #[error("The server refused the terminal or shell")]
    ShellRefused,
    #[error("The server closed the connection before opening the shell")]
    ClosedBeforeShell,
    #[error("Invalid session identifier")]
    SessionIdInvalid,
    #[error("Invalid or already open session identifier")]
    SessionIdInvalidOrOpen,
    #[error("Session already open")]
    SessionOpen,
    #[error("Local session already open")]
    LocalSessionOpen,
    #[error("Session closed")]
    SessionClosed,
    #[error("Invalid fingerprint")]
    FingerprintInvalid,
    #[error("This host already has a saved fingerprint")]
    FingerprintAlreadySaved,
    #[error("The destination has changed. Verify the fingerprint again.")]
    DestinationChanged,
    #[error("Password too long")]
    PasswordTooLong,
    #[error("Send at most 64 KiB per message to the terminal")]
    InputTooLarge,
    #[error("Invalid address")]
    UrlInvalid,
}
impl TerminalError {
    /// Wraps an error of the PTY library, which only offers its text.
    pub(crate) fn pty(error: impl std::fmt::Display) -> Self {
        Self::Pty(error.to_string())
    }
}
// What the server still accepts, so the user sees why key and password were both refused.
fn refusal_text(methods: &[&'static str]) -> String {
    if methods.is_empty() {
        return "Authentication failed".into();
    }
    format!(
        "Authentication failed. Methods accepted by the server: {}.{}",
        methods.join(", "),
        if has_unsupported(methods) {
            " Shellnest only supports key and password."
        } else {
            ""
        }
    )
}
fn has_unsupported(methods: &[&str]) -> bool {
    methods
        .iter()
        .any(|m| !matches!(*m, "password" | "publickey"))
}
// The UI picks the sentence by `context`: none, or a method Shellnest cannot use.
fn refusal<S: serde::Serializer>(
    methods: &[&'static str],
    serializer: S,
) -> Result<S::Ok, S::Error> {
    use serde::ser::SerializeMap;
    let mut map = serializer.serialize_map(None)?;
    map.serialize_entry("methods", &methods.join(", "))?;
    if methods.is_empty() {
        map.serialize_entry("context", "none")?;
    } else if has_unsupported(methods) {
        map.serialize_entry("context", "unsupported")?;
    }
    map.end()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_refusal_names_what_the_server_accepts() {
        assert_eq!(
            TerminalError::AuthRefused(vec![]).to_string(),
            "Authentication failed"
        );
        assert_eq!(
            TerminalError::AuthRefused(vec!["password", "publickey"]).to_string(),
            "Authentication failed. Methods accepted by the server: password, publickey."
        );
        assert_eq!(
            TerminalError::AuthRefused(vec!["keyboard-interactive"]).to_string(),
            "Authentication failed. Methods accepted by the server: keyboard-interactive. Shellnest only supports key and password."
        );
    }
}
