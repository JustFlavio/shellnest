use super::{Transfer, publication};
use crate::sftp::{SftpError, Side, local};
use russh_sftp::protocol::{FileAttributes, OpenFlags};
use std::time::Duration;
use tokio::{
    fs,
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
};

impl Transfer<'_> {
    async fn stream(
        &mut self,
        mut source: impl AsyncRead + Unpin,
        mut target: impl AsyncWrite + Unpin,
    ) -> Result<(), SftpError> {
        let mut buffer = zeroize::Zeroizing::new(vec![0; 64 * 1024]);
        loop {
            self.check()?;
            let n = tokio::select! { biased; _ = self.token.cancelled() => return Err(SftpError::Cancelled), n = source.read(&mut buffer) => n? };
            if n == 0 {
                break;
            }
            tokio::select! { biased; _ = self.token.cancelled() => return Err(SftpError::Cancelled), result = target.write_all(&buffer[..n]) => result? };
            self.advance(n);
        }
        target.shutdown().await?;
        Ok(())
    }
    pub(super) async fn copy_file(&mut self, source: &str, target: &str) -> Result<(), SftpError> {
        let client = self.session.client()?;
        let upload = self.request.side == Side::Local;
        let temp = if upload {
            let parent = target.rsplit_once('/').ok_or(SftpError::InvalidPath)?.0;
            format!("{parent}/.shellnest-{}.part", crate::model::new_id())
        } else {
            local::text(
                &local::checked(target)?
                    .with_file_name(format!(".shellnest-{}.part", crate::model::new_id())),
            )?
        };
        let result = async {
            if upload {
                let source = local::open_regular(source).await?;
                let file = client
                    .open_with_flags_and_attributes(
                        &temp,
                        OpenFlags::CREATE | OpenFlags::EXCLUDE | OpenFlags::WRITE,
                        FileAttributes {
                            permissions: Some(0o600),
                            ..Default::default()
                        },
                    )
                    .await?;
                self.stream(source, file).await?;
            } else {
                let source = client.open(source).await?;
                let m = source.metadata().await?;
                if !m.is_regular() {
                    return Err(SftpError::UnsupportedType);
                }
                let mut options = fs::OpenOptions::new();
                options.write(true).create_new(true);
                #[cfg(unix)]
                {
                    options.mode(0o600);
                }
                let file = options.open(&temp).await?;
                self.stream(source, file).await?;
            }
            self.check()?;
            publication::publish(client, upload, &temp, target, self.request.conflict).await
        }
        .await;
        if result.is_err() {
            // Best effort cleanup is bounded; a disconnected server may leave a clearly named .part.
            let _ = tokio::time::timeout(Duration::from_secs(3), async {
                if upload {
                    let _ = client.remove_file(&temp).await;
                } else {
                    let _ = fs::remove_file(&temp).await;
                }
            })
            .await;
        }
        result
    }
}
