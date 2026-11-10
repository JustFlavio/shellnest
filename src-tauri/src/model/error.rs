//! Errors of editing and resolving the vault contents.
/// Why an edit of the vault contents was refused. The messages are shown to the user as they are.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum ModelError {
    #[error("Missing or duplicate identifiers in the vault")]
    InvalidIds,
    #[error("Give the identity a name")]
    IdentityIncomplete,
    #[error("Identity with an invalid key reference")]
    IdentityKeyInvalid,
    #[error("Parent folder not found")]
    GroupParentMissing,
    #[error("Folders can be at most {0} levels deep")]
    GroupTooDeep(usize),
    #[error("Invalid folder name")]
    GroupNameInvalid,
    #[error("The identity of folder {0} does not exist")]
    GroupSettingsInvalid(String),
    #[error("A folder named {0} already exists")]
    GroupNameTaken(String),
    #[error("A folder cannot be inside itself")]
    GroupInsideItself,
    #[error("The folder is not empty: move or delete its contents first.")]
    GroupNotEmpty,
    #[error("The folder of host {0} does not exist")]
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
    #[error("Give the host a name")]
    HostFieldsRequired,
    #[error("Inherit the identity from the folder or choose one, not both")]
    InheritConflict,
    #[error("Enter the host credentials or choose an identity")]
    CredentialsRequired,
    #[error("Invalid SSH user")]
    UsernameInvalid,
    #[error("Enter a password")]
    PasswordRequired,
    #[error("Choose host credentials or an identity, not both")]
    CredentialsAndIdentity,
    #[error("Host not found")]
    HostNotFound,
    #[error("Invalid operating system")]
    OsInvalid,
    #[error("Invalid IP address or host name")]
    EndpointInvalid,
    #[error("Enter a port from 1 to 65535")]
    PortInvalid,
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
    #[error("You can only view this shared vault: ask an editor to make the change")]
    ReadOnly,
}
impl ModelError {
    /// The form field the error belongs to, so the UI can show it under that field.
    pub(crate) fn field(&self) -> Option<&'static str> {
        Some(match self {
            Self::HostFieldsRequired
            | Self::IdentityIncomplete
            | Self::KeyNameMissing
            | Self::GroupNameInvalid
            | Self::GroupNameTaken(_) => "name",
            Self::EndpointInvalid => "address",
            Self::PortInvalid => "port",
            Self::HostTagsInvalid => "tags",
            Self::UsernameInvalid | Self::UsernameMissing => "username",
            Self::PasswordRequired => "password",
            Self::IdentityKeyInvalid | Self::HostCredentialsInvalid => "key",
            Self::KeyImportRequired | Self::KeyUnreadable | Self::KeyDuplicate => "privateKey",
            Self::CredentialsRequired
            | Self::CredentialsAndIdentity
            | Self::InheritConflict
            | Self::HostWithoutIdentity(_)
            | Self::HostIdentityMissing(_)
            | Self::GroupSettingsInvalid(_) => "identity",
            Self::HostPlacementInvalid(_)
            | Self::GroupParentMissing
            | Self::GroupTooDeep(_)
            | Self::GroupInsideItself => "group",
            _ => return None,
        })
    }
}
