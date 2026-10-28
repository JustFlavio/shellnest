use crate::{error::Error, terminal::TerminalError};
// Opens a link clicked in the terminal with the system handler. Only plain http(s) URLs
// are accepted, and the URL is passed as a single argument (no shell involved).
#[tauri::command]
pub(crate) fn open_url(url: String) -> Result<(), Error> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://"))
        || url.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return Err(TerminalError::UrlInvalid.into());
    }
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("rundll32");
        c.arg("url.dll,FileProtocolHandler");
        c
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(&url).spawn().map_err(TerminalError::from)?;
    Ok(())
}

/// The texts of the macOS menu, in the language the UI shows; it sends them again when the language changes.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MenuLabels {
    pub(crate) check_updates: String,
    pub(crate) settings: String,
    pub(crate) vault: String,
    pub(crate) lock_vault: String,
    pub(crate) close_all_sessions: String,
    pub(crate) edit: String,
    pub(crate) window: String,
}
impl Default for MenuLabels {
    fn default() -> Self {
        Self {
            check_updates: "Check for updates…".into(),
            settings: "Settings…".into(),
            vault: "Vault".into(),
            lock_vault: "Lock vault".into(),
            close_all_sessions: "Close all sessions".into(),
            edit: "Edit".into(),
            window: "Window".into(),
        }
    }
}
#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub(crate) fn set_menu_labels(app: tauri::AppHandle, labels: MenuLabels) -> Result<(), Error> {
    #[cfg(target_os = "macos")]
    crate::menu::relabel(&app, &labels)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_frontend_sends_its_labels_in_camel_case() {
        let json = r#"{"checkUpdates":"a","settings":"b","vault":"c","lockVault":"d","closeAllSessions":"e","edit":"f","window":"g"}"#;
        let labels: MenuLabels = serde_json::from_str(json).unwrap();
        assert_eq!(labels.close_all_sessions, "e");
    }
}
