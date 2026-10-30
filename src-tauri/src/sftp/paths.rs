use super::SftpError;
use std::path::{Component, Path};

pub(super) fn path(value: &str) -> Result<(), SftpError> {
    if value.is_empty() || value.len() > 32768 || value.contains('\0') {
        return Err(SftpError::InvalidPath);
    }
    Ok(())
}
pub(super) fn name(value: &str) -> Result<(), SftpError> {
    if value.is_empty() || value == "." || value == ".." || value.contains(['/', '\\', '\0']) {
        return Err(SftpError::InvalidPath);
    }
    Ok(())
}
pub(super) fn local_name(value: &str) -> Result<(), SftpError> {
    name(value)?;
    if Path::new(value)
        .components()
        .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(SftpError::InvalidPath);
    }
    #[cfg(windows)]
    {
        let stem = value.split('.').next().unwrap_or("").to_ascii_uppercase();
        if value.contains([':', '<', '>', '"', '|', '?', '*'])
            || value.chars().any(|c| c.is_control())
            || value.ends_with(['.', ' '])
            || matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || (stem.len() == 4
                && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && stem.as_bytes()[3].is_ascii_digit())
        {
            return Err(SftpError::InvalidPath);
        }
    }
    Ok(())
}
pub(super) fn join(parent: &str, child: &str) -> Result<String, SftpError> {
    path(parent)?;
    name(child)?;
    Ok(format!("{}/{child}", parent.trim_end_matches('/')))
}
pub(super) fn copy_name(value: &str, n: u32) -> String {
    match value.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => format!("{stem} ({n}).{ext}"),
        _ => format!("{value} ({n})"),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_server_names_that_escape_the_selected_directory() {
        for value in ["", ".", "..", "../secret", "a/b", "a\\b", "x\0y"] {
            assert!(name(value).is_err(), "{value:?}");
        }
        assert_eq!(join("/", "file").unwrap(), "/file");
        assert_eq!(copy_name("archive.tar.gz", 2), "archive.tar (2).gz");
        assert_eq!(copy_name(".env", 1), ".env (1)");
    }
}
