//! App startup: data directory, the single-instance lock and the shared state.
use crate::state::AppState;
use std::path::Path;
use tauri::Manager;

fn claim_instance(path: &Path) -> std::io::Result<std::fs::File> {
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)?;
    file.try_lock().map_err(|e| {
        std::io::Error::other(format!(
            "Cannot open the local vault: close the other instances of Shellnest. {e}"
        ))
    })?;
    Ok(file)
}
/// Moves the data folder of the old identifier to the new one, so existing vaults survive the rename.
// shortcut: skipped when the new folder already exists (nothing is merged), fine while there are no other users.
#[cfg(not(feature = "desktop-e2e"))]
fn migrate_legacy_data_dir(dir: &Path) {
    let legacy = dir.with_file_name("dev.servermanager.desktop");
    if !dir.exists() && legacy.is_dir() {
        let _ = std::fs::rename(&legacy, dir);
    }
}

pub(crate) fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(not(feature = "desktop-e2e"))]
    let dir = {
        let dir = app.path().app_data_dir()?;
        migrate_legacy_data_dir(&dir);
        dir
    };
    #[cfg(feature = "desktop-e2e")]
    let dir = {
        let path = std::path::PathBuf::from(std::env::var("SHELLNEST_E2E_DATA_DIR")?);
        if !path.is_absolute() || !path.is_dir() {
            return Err("E2E requires an existing absolute temporary data directory".into());
        }
        path
    };
    #[cfg(target_os = "macos")]
    crate::menu::install(app)?;
    std::fs::create_dir_all(&dir)?;
    // Retain the OS file lock for the app lifetime to prevent two processes writing one vault.
    app.manage(claim_instance(&dir.join("instance.lock"))?);
    app.manage(AppState::new(dir.join("vault.json"))?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::VaultFixture;
    #[cfg(not(feature = "desktop-e2e"))]
    #[test]
    fn legacy_data_dir_moves_only_when_the_new_one_is_missing() {
        let fixture = VaultFixture::new();
        let legacy = fixture.root.join("dev.servermanager.desktop");
        let dir = fixture.root.join("io.github.justflavio.shellnest");
        std::fs::create_dir_all(&legacy).unwrap();
        std::fs::write(legacy.join("vault.json"), "v").unwrap();
        migrate_legacy_data_dir(&dir);
        assert!(dir.join("vault.json").exists() && !legacy.exists());
        std::fs::create_dir_all(&legacy).unwrap();
        migrate_legacy_data_dir(&dir);
        assert!(legacy.exists());
    }
    #[test]
    fn concurrent_app_instances_cannot_write_the_same_vault() {
        let fixture = VaultFixture::new();
        let path = fixture.root.join("instance.lock");
        let first = claim_instance(&path).unwrap();
        assert!(claim_instance(&path).is_err());
        drop(first);
        assert!(claim_instance(&path).is_ok());
    }
}
