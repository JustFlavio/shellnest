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
