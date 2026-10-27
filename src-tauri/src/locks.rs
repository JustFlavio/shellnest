//! One policy for poisoned mutexes.
//!
//! The vault and the catalog are only ever replaced as a whole after validation, but a panic while
//! they are held still means we cannot vouch for them: those two report an error (see
//! `AppState::vault` and `AppState::catalog`). Everything else behind a mutex is a plain registry
//! (open sessions, local children, a pending question). Refusing to touch it after a panic elsewhere
//! would make things worse, for example a poisoned session map would stop `lock` from closing sessions,
//! so `lock_recovering` takes the data as it is.
use std::sync::{Mutex, MutexGuard};

pub(crate) trait MutexExt<T> {
    /// Locks a registry whose contents stay valid even if a holder panicked.
    fn lock_recovering(&self) -> MutexGuard<'_, T>;
}
impl<T> MutexExt<T> for Mutex<T> {
    fn lock_recovering(&self) -> MutexGuard<'_, T> {
        self.lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_registry_stays_usable_after_a_holder_panicked() {
        let registry = std::sync::Arc::new(Mutex::new(vec![1]));
        let poisoner = registry.clone();
        let _ = std::thread::spawn(move || {
            let _guard = poisoner.lock().unwrap();
            panic!("poison the lock");
        })
        .join();
        assert!(registry.lock().is_err());
        registry.lock_recovering().push(2);
        assert_eq!(*registry.lock_recovering(), vec![1, 2]);
    }
}
