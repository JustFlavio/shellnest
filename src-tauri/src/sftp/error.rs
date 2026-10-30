#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum SftpError {
    #[error(
        "Host settings changed since this pane was opened. Open a new session to the updated host."
    )]
    DestinationChanged,
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    #[serde(serialize_with = "crate::error::as_text")]
    Protocol(#[from] russh_sftp::client::error::Error),
    #[error("Invalid path or file name")]
    InvalidPath,
    #[error("The server refused the SFTP subsystem")]
    SubsystemRefused,
    #[error("Session is not connected")]
    NotConnected,
    #[error("Operation cancelled")]
    Cancelled,
    #[error("Destination already exists")]
    Exists,
    #[error("Symbolic links and special files cannot be transferred recursively")]
    UnsupportedType,
    #[error("Cannot replace a file with a directory or a directory with a file")]
    TypeConflict,
    #[error("The replacement failed; the original is preserved at {0}")]
    Recovery(String),
    #[error("A transfer is already using this session")]
    TransferBusy,
}
