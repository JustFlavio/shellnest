use super::Conflict;
use crate::sftp::{SftpError, local, remote};
use russh_sftp::client::SftpSession;
use tokio::fs;

// Publication is not cancelled halfway: once the original moves, restore or retain its backup.
pub(super) async fn publish(
    client: &SftpSession,
    upload: bool,
    temp: &str,
    target: &str,
    conflict: Conflict,
) -> Result<(), SftpError> {
    if !upload {
        return publish_local(temp, target, conflict).await;
    }
    let existing = remote::exists(client, target).await?;
    if existing.is_none() {
        // SFTP v3 RENAME fails when the destination exists.
        return Ok(client.rename(temp, target).await?);
    }
    if conflict != Conflict::Replace {
        return Err(SftpError::Exists);
    }
    let m = existing.ok_or(SftpError::Exists)?;
    if !m.is_regular() || m.is_symlink() {
        return Err(SftpError::TypeConflict);
    }
    if let Some(permissions) = m.permissions {
        client
            .set_metadata(
                temp,
                russh_sftp::protocol::FileAttributes {
                    permissions: Some(permissions & 0o777),
                    ..Default::default()
                },
            )
            .await?;
    }
    let backup = format!("{target}.shellnest-{}.backup", crate::model::new_id());
    client.rename(target, &backup).await?;
    if let Err(error) = client.rename(temp, target).await {
        if client.rename(&backup, target).await.is_err() {
            return Err(SftpError::Recovery(backup));
        }
        return Err(error.into());
    }
    if client.remove_file(&backup).await.is_err() {
        return Err(SftpError::Recovery(backup));
    }
    Ok(())
}
async fn publish_local(temp: &str, target: &str, conflict: Conflict) -> Result<(), SftpError> {
    if conflict == Conflict::Replace {
        if let Some(m) = local::exists(target).await? {
            if !m.is_file() || m.is_symlink() {
                return Err(SftpError::TypeConflict);
            }
            fs::set_permissions(temp, m.permissions()).await?;
        }
        fs::rename(temp, target).await?;
    } else {
        local::rename_new(temp, target).await?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn publication_never_clobbers_without_explicit_replace() {
        let root = std::env::temp_dir().join(format!("shellnest-copy-{}", crate::model::new_id()));
        fs::create_dir(&root).await.unwrap();
        let temp = local::text(&root.join("temp")).unwrap();
        let target = local::text(&root.join("target")).unwrap();
        fs::write(&target, b"original").await.unwrap();
        fs::write(&temp, b"replacement").await.unwrap();
        assert!(matches!(
            publish_local(&temp, &target, Conflict::Ask).await,
            Err(SftpError::Exists)
        ));
        assert_eq!(fs::read(&target).await.unwrap(), b"original");
        publish_local(&temp, &target, Conflict::Replace)
            .await
            .unwrap();
        assert_eq!(fs::read(&target).await.unwrap(), b"replacement");
        assert!(!fs::try_exists(&temp).await.unwrap());
        fs::remove_dir_all(root).await.unwrap();
    }
}
