use std::sync::{Arc, Mutex};
use tokio::sync::{oneshot, Notify};
use zeroize::Zeroizing;

/// The one question to the user that may be open: the password for the session being authenticated.
#[derive(Clone, Default)]
pub(super) struct PasswordPrompt {
    slot: Arc<Mutex<Option<oneshot::Sender<Zeroizing<String>>>>>,
    opened: Arc<Notify>,
}
impl PasswordPrompt {
    pub(super) fn ask(&self) -> oneshot::Receiver<Zeroizing<String>> {
        let (tx, rx) = oneshot::channel();
        if let Ok(mut slot) = self.slot.lock() {
            *slot = Some(tx);
        }
        self.opened.notify_one();
        rx
    }
    pub(super) fn asking(&self) -> bool {
        self.slot.lock().is_ok_and(|slot| slot.is_some())
    }
    /// Completes when a question is opened, so a waiting loop can look again at `asking`.
    pub(super) async fn opened(&self) {
        self.opened.notified().await;
    }
    // An answer nobody asked for is dropped, and zeroized with it.
    pub(super) fn answer(&self, password: Zeroizing<String>) -> bool {
        let tx = self.slot.lock().ok().and_then(|mut slot| slot.take());
        tx.is_some_and(|tx| tx.send(password).is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn a_password_is_delivered_only_to_an_open_question() {
        let prompt = PasswordPrompt::default();
        assert!(!prompt.asking());
        assert!(!prompt.answer(Zeroizing::new("early".into())));
        let answer = prompt.ask();
        assert!(prompt.asking());
        assert!(prompt.answer(Zeroizing::new("typed".into())));
        assert!(!prompt.asking());
        assert_eq!(answer.await.unwrap().as_str(), "typed");
        // A second answer to the same question has nowhere to go.
        assert!(!prompt.answer(Zeroizing::new("again".into())));
        // Dropping the question (session closed) ends the wait.
        let answer = prompt.ask();
        drop(prompt);
        assert!(answer.await.is_err());
    }
}
