//! Errors of editing and resolving the vault contents.
/// Why an edit of the vault contents was refused. The messages are shown to the user as they are.
#[derive(Debug, thiserror::Error)]
pub(crate) enum ModelError {
    #[error("Identificativi mancanti o duplicati nel vault")]
    InvalidIds,
    #[error("Identità senza nome o utente")]
    IdentityIncomplete,
    #[error("Identità con riferimento alla chiave non valido")]
    IdentityKeyInvalid,
    #[error("Gruppo padre non trovato")]
    GroupParentMissing,
    #[error("Le cartelle possono avere al massimo {0} livelli")]
    GroupTooDeep(usize),
    #[error("Nome cartella non valido")]
    GroupNameInvalid,
    #[error("Impostazioni della cartella {0} non valide")]
    GroupSettingsInvalid(String),
    #[error("Esiste già una cartella chiamata {0}")]
    GroupNameTaken(String),
    #[error("Una cartella non può stare dentro se stessa")]
    GroupInsideItself,
    #[error("La cartella non è vuota: sposta o elimina prima il suo contenuto.")]
    GroupNotEmpty,
    #[error("Porta o cartella non valida per l’host {0}")]
    HostPlacementInvalid(String),
    #[error("Credenziali dell’host non valide o in conflitto con un’identità")]
    HostCredentialsInvalid,
    #[error("L’host {0} non ha un’identità e la sua cartella non ne fornisce una")]
    HostWithoutIdentity(String),
    #[error("L’host {0} fa riferimento a un’identità mancante")]
    HostIdentityMissing(String),
    #[error("Workspace {0} non valido")]
    WorkspaceInvalid(String),
    #[error("Chiave privata non valida o passphrase errata")]
    KeyUnreadable,
    #[error("Assegna un nome alla chiave")]
    KeyNameMissing,
    #[error("Importa una chiave privata")]
    KeyImportRequired,
    #[error("Questa chiave è già presente nel portachiavi")]
    KeyDuplicate,
    #[error("Chiave utilizzata da {0} identità. Riassegna prima le identità.")]
    KeyInUse(usize),
    #[error("Identità utilizzata da {0} host o cartelle. Riassegnali prima.")]
    IdentityInUse(usize),
    #[error("Seleziona host e identità validi")]
    AssignInvalid,
    #[error("Uno degli host selezionati non esiste più")]
    AssignHostMissing,
    #[error("Nome, indirizzo e porta valida sono obbligatori")]
    HostFieldsRequired,
    #[error("Eredita l’identità dalla cartella oppure sceglila, non entrambe")]
    InheritConflict,
    #[error("Inserisci le credenziali dell’host o scegli un’identità")]
    CredentialsRequired,
    #[error("Utente SSH non valido")]
    UsernameInvalid,
    #[error("Inserisci una password per questo host")]
    PasswordRequired,
    #[error("Scegli credenziali dell’host oppure un’identità, non entrambe")]
    CredentialsAndIdentity,
    #[error("Host non trovato")]
    HostNotFound,
    #[error("Sistema operativo non valido")]
    OsInvalid,
    #[error("Indirizzo IP o nome host e porta non validi")]
    EndpointInvalid,
    #[error("Identità non trovata")]
    IdentityNotFound,
    #[error("Chiave non trovata")]
    KeyNotFound,
    #[error("Indirizzo o porta non validi")]
    TargetInvalid,
    #[error("Verifica prima l’impronta del server")]
    FingerprintUnverified,
    #[error("Indica l’utente SSH")]
    UsernameMissing,
}
