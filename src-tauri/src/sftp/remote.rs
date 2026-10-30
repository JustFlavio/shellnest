use super::{Directory, Mutation, SftpError, files::Entry, paths};
use russh_sftp::{
    client::SftpSession,
    protocol::{FileAttributes, StatusCode},
};

pub(super) async fn list(sftp: &SftpSession, value: &str) -> Result<Directory, SftpError> {
    let path = sftp
        .canonicalize(if value.is_empty() {
            "."
        } else {
            paths::path(value)?;
            value
        })
        .await?;
    let mut entries = Vec::new();
    for entry in sftp.read_dir(&path).await? {
        let name = entry.file_name();
        let full = paths::join(&path, &name)?;
        let m = entry.metadata();
        entries.push(Entry {
            hidden: name.starts_with('.'),
            name,
            path: full,
            kind: if m.is_symlink() {
                "symlink"
            } else if m.is_dir() {
                "directory"
            } else if m.is_regular() {
                "file"
            } else {
                "other"
            },
            size: m.size,
            modified: m.mtime.map(u64::from),
        });
    }
    let parent = (path != "/").then(|| {
        path.rsplit_once('/')
            .map(|(p, _)| if p.is_empty() { "/" } else { p }.to_owned())
            .unwrap_or_else(|| "/".into())
    });
    Ok(Directory {
        path,
        parent,
        roots: vec!["/".into()],
        entries,
    })
}
pub(super) async fn exists(
    sftp: &SftpSession,
    path: &str,
) -> Result<Option<FileAttributes>, SftpError> {
    paths::path(path)?;
    match sftp.symlink_metadata(path).await {
        Ok(m) => Ok(Some(m)),
        Err(russh_sftp::client::error::Error::Status(s))
            if s.status_code == StatusCode::NoSuchFile =>
        {
            Ok(None)
        }
        Err(e) => Err(e.into()),
    }
}
pub(super) async fn mutate(sftp: &SftpSession, operation: Mutation) -> Result<(), SftpError> {
    match operation {
        Mutation::Mkdir { parent, name } => sftp.create_dir(paths::join(&parent, &name)?).await?,
        Mutation::Rename { path, name } => {
            paths::path(&path)?;
            let parent = path
                .rsplit_once('/')
                .filter(|(_, n)| !n.is_empty())
                .ok_or(SftpError::InvalidPath)?
                .0;
            let target = paths::join(if parent.is_empty() { "/" } else { parent }, &name)?;
            if exists(sftp, &target).await?.is_some() {
                return Err(SftpError::Exists);
            }
            sftp.rename(path, target).await?;
        }
        Mutation::Delete { paths: selected } => {
            if selected.is_empty() || selected.len() > 10000 {
                return Err(SftpError::InvalidPath);
            }
            // Explicit postorder stack avoids following links and recursive async futures.
            let mut stack: Vec<_> = selected.into_iter().map(|p| (p, false)).collect();
            while let Some((path, visited)) = stack.pop() {
                paths::path(&path)?;
                if !path.starts_with('/')
                    || path.trim_matches('/').is_empty()
                    || path.split('/').any(|p| matches!(p, "." | ".."))
                {
                    return Err(SftpError::InvalidPath);
                }
                if visited {
                    sftp.remove_dir(path).await?;
                    continue;
                }
                let m = sftp.symlink_metadata(&path).await?;
                if m.is_dir() && !m.is_symlink() {
                    stack.push((path.clone(), true));
                    for entry in sftp.read_dir(&path).await? {
                        stack.push((paths::join(&path, &entry.file_name())?, false));
                    }
                } else {
                    sftp.remove_file(path).await?;
                }
            }
        }
    }
    Ok(())
}
