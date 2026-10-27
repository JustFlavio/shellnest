//! Shared fixtures for tests that need a vault directory on disk.
use crate::state::AppState;
use std::path::PathBuf;

pub(crate) struct VaultFixture {
    pub(crate) root: PathBuf,
}
impl VaultFixture {
    pub(crate) fn new() -> Self {
        let root =
            std::env::temp_dir().join(format!("shellnest-vault-test-{}", rand::random::<u64>()));
        std::fs::create_dir_all(&root).unwrap();
        Self { root }
    }
    pub(crate) fn state(&self) -> AppState {
        AppState::new(self.root.join("vault.json")).unwrap()
    }
}
impl Drop for VaultFixture {
    fn drop(&mut self) {
        if self.root.parent() == Some(std::env::temp_dir().as_path())
            && self
                .root
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("shellnest-vault-test-")
        {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
}
