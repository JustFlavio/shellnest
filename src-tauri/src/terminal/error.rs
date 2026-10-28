//! Errors of SSH sessions, host key probing and the local PTY.
/// Why a terminal session, a local PTY or a host key check failed. The messages are shown to the user.
#[derive(Debug, thiserror::Error)]
pub(crate) enum TerminalError {
    #[error("{0}")]
    Ssh(#[from] russh::Error),
    #[error("{0}")]
    Key(#[from] russh::keys::Error),
    #[error("{0}")]
    Io(#[from] std::io::Error),
    // The PTY library reports opaque errors; only their text is kept.
    #[error("{0}")]
    Pty(String),
    #[cfg(unix)]
    #[error("{0}")]
    Errno(#[from] nix::errno::Errno),
    #[cfg(unix)]
    #[error("PTY locale senza descrittore nativo")]
    NoPtyDescriptor,
    #[error("Timeout durante la verifica del server")]
    ProbeTimeout,
    #[error("Impronta non disponibile")]
    FingerprintUnavailable,
    #[error("Timeout connessione SSH")]
    ConnectTimeout,
    #[error(
        "Identità del server cambiata. Connessione bloccata: verifica la nuova impronta fuori dall’app."
    )]
    ServerKeyChanged,
    #[error("{}", refusal_text(.0))]
    AuthRefused(Vec<&'static str>),
    #[error("Autenticazione annullata")]
    AuthCancelled,
    #[error("Password non accettata dopo {0} tentativi.")]
    PasswordsExhausted(usize),
    #[error("Risposta iniziale del server troppo grande")]
    InitialOutputTooLarge,
    #[error("Il server ha rifiutato terminale o shell")]
    ShellRefused,
    #[error("Il server ha chiuso la connessione prima di aprire la shell")]
    ClosedBeforeShell,
    #[error("Identificativo sessione non valido")]
    SessionIdInvalid,
    #[error("Identificativo sessione non valido o già aperto")]
    SessionIdInvalidOrOpen,
    #[error("Sessione già aperta")]
    SessionOpen,
    #[error("Sessione locale già aperta")]
    LocalSessionOpen,
    #[error("Sessione chiusa")]
    SessionClosed,
    #[error("Impronta non valida")]
    FingerprintInvalid,
    #[error("Questo host ha già un’impronta salvata")]
    FingerprintAlreadySaved,
    #[error("La destinazione è cambiata. Ripeti la verifica dell’impronta.")]
    DestinationChanged,
    #[error("Password troppo lunga")]
    PasswordTooLong,
    #[error("Invia al massimo 64 KiB per messaggio al terminale")]
    InputTooLarge,
    #[error("Indirizzo non valido")]
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
        return "Autenticazione fallita".into();
    }
    let unsupported = methods
        .iter()
        .any(|m| !matches!(*m, "password" | "publickey"));
    format!(
        "Autenticazione fallita. Metodi accettati dal server: {}.{}",
        methods.join(", "),
        if unsupported {
            " Shellnest supporta solo chiave e password."
        } else {
            ""
        }
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_refusal_names_what_the_server_accepts() {
        assert_eq!(
            TerminalError::AuthRefused(vec![]).to_string(),
            "Autenticazione fallita"
        );
        assert_eq!(
            TerminalError::AuthRefused(vec!["password", "publickey"]).to_string(),
            "Autenticazione fallita. Metodi accettati dal server: password, publickey."
        );
        assert_eq!(
            TerminalError::AuthRefused(vec!["keyboard-interactive"]).to_string(),
            "Autenticazione fallita. Metodi accettati dal server: keyboard-interactive. Shellnest supporta solo chiave e password."
        );
    }
}
