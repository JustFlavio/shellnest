//! Errors of editing and resolving the vault contents.
/// Why an edit of the vault contents was refused. The messages are shown to the user as they are.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum ModelError {
    #[error("Missing or duplicate identifiers in the vault")]
    InvalidIds,
    #[error("Identity without a name or user")]
    IdentityIncomplete,
    #[error("Identity with an invalid key reference")]
    IdentityKeyInvalid,
    #[error("Parent folder not found")]
    GroupParentMissing,
    #[error("Folders can be at most {0} levels deep")]
    GroupTooDeep(usize),
    #[error("Invalid folder name")]
    GroupNameInvalid,
    #[error("Invalid settings for folder {0}")]
    GroupSettingsInvalid(String),
    #[error("A folder named {0} already exists")]
    GroupNameTaken(String),
    #[error("A folder cannot be inside itself")]
    GroupInsideItself,
    #[error("The folder is not empty: move or delete its contents first.")]
    GroupNotEmpty,
    #[error("Invalid port or folder for host {0}")]
    HostPlacementInvalid(String),
    #[error("Host credentials are invalid or conflict with an identity")]
    HostCredentialsInvalid,
    #[error("Use up to 32 tags, each with 1–64 characters")]
    HostTagsInvalid,
    #[error("Key used by {0} hosts. Reassign them first.")]
    KeyInUseByHosts(usize),
    #[error("Host {0} has no identity and its folder does not provide one")]
    HostWithoutIdentity(String),
    #[error("Host {0} refers to a missing identity")]
    HostIdentityMissing(String),
    #[error("Invalid workspace {0}")]
    WorkspaceInvalid(String),
    #[error("Invalid private key or wrong passphrase")]
    KeyUnreadable,
    #[error("Give the key a name")]
    KeyNameMissing,
    #[error("Import a private key")]
    KeyImportRequired,
    #[error("This key is already in the key store")]
    KeyDuplicate,
    #[error("Key used by {0} identities. Reassign the identities first.")]
    KeyInUse(usize),
    #[error("Identity used by {0} hosts or folders. Reassign them first.")]
    IdentityInUse(usize),
    #[error("Select valid hosts and an identity")]
    AssignInvalid,
    #[error("One of the selected hosts no longer exists")]
    AssignHostMissing,
    #[error("Name, address and a valid port are required")]
    HostFieldsRequired,
    #[error("Inherit the identity from the folder or choose one, not both")]
    InheritConflict,
    #[error("Enter the host credentials or choose an identity")]
    CredentialsRequired,
    #[error("Invalid SSH user")]
    UsernameInvalid,
    #[error("Enter a password for this host")]
    PasswordRequired,
    #[error("Choose host credentials or an identity, not both")]
    CredentialsAndIdentity,
    #[error("Host not found")]
    HostNotFound,
    #[error("Invalid operating system")]
    OsInvalid,
    #[error("Invalid IP address or host name and port")]
    EndpointInvalid,
    #[error("Identity not found")]
    IdentityNotFound,
    #[error("Key not found")]
    KeyNotFound,
    #[error("Invalid address or port")]
    TargetInvalid,
    #[error("Verify the server fingerprint first")]
    FingerprintUnverified,
    #[error("Enter the SSH user")]
    UsernameMissing,
}
