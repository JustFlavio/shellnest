//! The single open question to the user while authenticating: a password or keyboard-interactive prompts.
use crate::locks::MutexExt;
use std::sync::{Arc, Mutex};
use tokio::sync::{Notify, oneshot};
use zeroize::Zeroizing;

/// What the user typed, one answer per prompt (a password is a single answer).
pub(crate) type Answers = Vec<Zeroizing<String>>;

/// The one question to the user that may be open while the session is authenticated: its answers come back here.
#[derive(Clone, Default)]
pub(crate) struct PasswordPrompt {
    slot: Arc<Mutex<Option<oneshot::Sender<Answers>>>>,
    opened: Arc<Notify>,
}
impl PasswordPrompt {
    pub(crate) fn ask(&self) -> oneshot::Receiver<Answers> {
        let (tx, rx) = oneshot::channel();
        *self.slot.lock_recovering() = Some(tx);
        self.opened.notify_one();
        rx
    }
    pub(crate) fn asking(&self) -> bool {
        self.slot.lock_recovering().is_some()
    }
    /// Completes when a question is opened, so a waiting loop can look again at `asking`.
    pub(crate) async fn opened(&self) {
        self.opened.notified().await;
    }
    // An answer nobody asked for is dropped, and zeroized with it.
    pub(crate) fn answer(&self, answers: Answers) -> bool {
        let tx = self.slot.lock_recovering().take();
        tx.is_some_and(|tx| tx.send(answers).is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn a_password_is_delivered_only_to_an_open_question() {
        let prompt = PasswordPrompt::default();
        assert!(!prompt.asking());
        assert!(!prompt.answer(vec![Zeroizing::new("early".into())]));
        let answer = prompt.ask();
        assert!(prompt.asking());
        assert!(prompt.answer(vec![Zeroizing::new("typed".into())]));
        assert!(!prompt.asking());
        assert_eq!(answer.await.unwrap()[0].as_str(), "typed");
        // A second answer to the same question has nowhere to go.
        assert!(!prompt.answer(vec![Zeroizing::new("again".into())]));
        // Dropping the question (session closed) ends the wait.
        let answer = prompt.ask();
        drop(prompt);
        assert!(answer.await.is_err());
    }
}
