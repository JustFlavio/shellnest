use super::{Directory, Mutation, SftpError, files::Entry, paths};
use std::{
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tokio::fs;

pub(super) fn text(path: &Path) -> Result<String, SftpError> {
    let value = path.to_str().ok_or(SftpError::InvalidPath)?;
    #[cfg(windows)]
    {
        if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
            return Ok(format!(r"\\{unc}"));
        }
        Ok(value.strip_prefix(r"\\?\").unwrap_or(value).to_owned())
    }
    #[cfg(not(windows))]
    Ok(value.to_owned())
}
pub(super) fn home() -> Result<String, SftpError> {
    std::env::var(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map_err(|_| SftpError::InvalidPath)
}
pub(super) fn checked(value: &str) -> Result<PathBuf, SftpError> {
    paths::path(value)?;
    let path = PathBuf::from(value);
    if !path.is_absolute()
        || path
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(SftpError::InvalidPath);
    }
    Ok(path)
}
pub(super) fn child(parent: &str, name: &str) -> Result<String, SftpError> {
    paths::local_name(name)?;
    text(&checked(parent)?.join(name))
}
pub(super) async fn open_regular(value: &str) -> Result<fs::File, SftpError> {
    let mut options = fs::OpenOptions::new();
    options.read(true);
    // A file changed into a link after listing must not upload an unrelated local secret.
    #[cfg(unix)]
    options.custom_flags(nix::libc::O_NOFOLLOW);
    #[cfg(windows)]
    options.custom_flags(0x00200000); // FILE_FLAG_OPEN_REPARSE_POINT
    let file = options.open(checked(value)?).await?;
    let metadata = file.metadata().await?;
    if !metadata.is_file() || metadata.is_symlink() {
        return Err(SftpError::UnsupportedType);
    }
    Ok(file)
}
pub(super) async fn rename_new(source: &str, target: &str) -> Result<(), SftpError> {
    let source = checked(source)?;
    let target = checked(target)?;
    // Checking existence before std::fs::rename would race with other sessions or programs.
    let result = tokio::task::spawn_blocking(move || renamore::rename_exclusive(source, target))
        .await
        .map_err(|e| std::io::Error::other(e.to_string()))?;
    match result {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Err(SftpError::Exists),
        Err(e) => Err(e.into()),
    }
}
pub(super) async fn list(value: &str) -> Result<Directory, SftpError> {
    let value = if value.is_empty() {
        home()?
    } else {
        value.to_owned()
    };
    let path = fs::canonicalize(checked(&value)?).await?;
    let mut entries = Vec::new();
    let mut dir = fs::read_dir(&path).await?;
    while let Some(entry) = dir.next_entry().await? {
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| SftpError::InvalidPath)?;
        let m = fs::symlink_metadata(entry.path()).await?;
        let kind = if m.is_symlink() {
            "symlink"
        } else if m.is_dir() {
            "directory"
        } else if m.is_file() {
            "file"
        } else {
            "other"
        };
        let hidden = name.starts_with('.');
        #[cfg(windows)]
        let hidden = {
            use std::os::windows::fs::MetadataExt;
            hidden || m.file_attributes() & 2 != 0
        };
        entries.push(Entry {
            name,
            path: text(&entry.path())?,
            kind,
            size: m.is_file().then_some(m.len()),
            modified: m
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|t| t.as_secs()),
            hidden,
        });
    }
    #[cfg(not(windows))]
    let roots = vec!["/".into()];
    #[cfg(windows)]
    let mut roots = Vec::new();
    #[cfg(windows)]
    {
        for drive in b'A'..=b'Z' {
            let root = format!("{}:\\", drive as char);
            if fs::try_exists(&root).await.unwrap_or(false) {
                roots.push(root);
            }
        }
    }
    Ok(Directory {
        path: text(&path)?,
        parent: path.parent().map(text).transpose()?,
        roots,
        entries,
    })
}
pub(super) async fn exists(path: &str) -> Result<Option<std::fs::Metadata>, SftpError> {
    match fs::symlink_metadata(checked(path)?).await {
        Ok(m) => Ok(Some(m)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}
pub(super) async fn mutate(operation: Mutation) -> Result<(), SftpError> {
    match operation {
        Mutation::Mkdir { parent, name } => fs::create_dir(child(&parent, &name)?).await?,
        Mutation::Rename { path, name } => {
            let original = checked(&path)?;
            let parent = text(original.parent().ok_or(SftpError::InvalidPath)?)?;
            let target = child(&parent, &name)?;
            rename_new(&text(&original)?, &target).await?;
        }
        Mutation::Delete { paths: selected } => {
            if selected.is_empty() || selected.len() > 10000 {
                return Err(SftpError::InvalidPath);
            }
            for value in selected {
                let path = checked(&value)?;
                if path.parent().is_none() {
                    return Err(SftpError::InvalidPath);
                }
                let m = fs::symlink_metadata(&path).await?;
                // remove_dir_all does not traverse symbolic links.
                if m.is_dir() && !m.is_symlink() {
                    fs::remove_dir_all(path).await?;
                } else {
                    fs::remove_file(path).await?;
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn local_paths_cannot_hide_a_root_delete_behind_parent_components() {
        #[cfg(windows)]
        let path = r"C:\Users\..\..";
        #[cfg(not(windows))]
        let path = "/home/user/../..";
        assert!(checked(path).is_err());
        assert!(checked("relative").is_err());
        #[cfg(windows)]
        {
            assert_eq!(text(Path::new(r"\\?\C:\Users")).unwrap(), r"C:\Users");
            assert!(paths::local_name("NUL.txt").is_err());
            assert!(paths::local_name("file:stream").is_err());
        }
    }
    #[tokio::test]
    async fn concurrent_renames_never_overwrite_each_other() {
        let root =
            std::env::temp_dir().join(format!("shellnest-rename-{}", crate::model::new_id()));
        fs::create_dir(&root).await.unwrap();
        let first = text(&root.join("first")).unwrap();
        let second = text(&root.join("second")).unwrap();
        let target = text(&root.join("target")).unwrap();
        fs::write(&first, b"first").await.unwrap();
        fs::write(&second, b"second").await.unwrap();
        let (a, b) = tokio::join!(rename_new(&first, &target), rename_new(&second, &target));
        assert_ne!(a.is_ok(), b.is_ok());
        if a.is_ok() {
            assert_eq!(fs::read(&target).await.unwrap(), b"first");
            assert!(fs::try_exists(&second).await.unwrap());
        } else {
            assert_eq!(fs::read(&target).await.unwrap(), b"second");
            assert!(fs::try_exists(&first).await.unwrap());
        }
        fs::remove_dir_all(root).await.unwrap();
    }
}
