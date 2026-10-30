//! One queued transfer per session. File data never crosses the UI boundary.
mod publication;
mod streaming;
use super::{
    SftpError, Side, local, paths, remote,
    session::{Event, Session},
};
use crate::{error::coded, locks::MutexExt};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Instant};
use tokio_util::sync::CancellationToken;

#[derive(Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Conflict {
    Ask,
    Replace,
    Skip,
    KeepBoth,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransferRequest {
    pub id: String,
    pub side: Side,
    pub source: String,
    pub destination: String,
    pub conflict: Conflict,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Progress {
    id: String,
    bytes: u64,
    current: String,
    status: &'static str,
    error: Option<serde_json::Value>,
}
struct Transfer<'a> {
    session: &'a Session,
    token: CancellationToken,
    request: TransferRequest,
    bytes: u64,
    current: String,
    last: Instant,
}
impl Transfer<'_> {
    fn report(&self, status: &'static str, error: Option<serde_json::Value>) {
        let _ = self.session.output.send(Event::Transfer(Progress {
            id: self.request.id.clone(),
            bytes: self.bytes,
            current: self.current.clone(),
            status,
            error,
        }));
    }
    fn check(&self) -> Result<(), SftpError> {
        if self.token.is_cancelled() {
            Err(SftpError::Cancelled)
        } else {
            Ok(())
        }
    }
    fn advance(&mut self, n: usize) {
        self.bytes += n as u64;
        if self.last.elapsed().as_millis() >= 100 {
            self.report("running", None);
            self.last = Instant::now();
        }
    }
    async fn run(&mut self) -> Result<(), SftpError> {
        let client = self.session.client()?;
        let upload = self.request.side == Side::Local;
        let source = self.request.source.clone();
        let name = if upload {
            local::text(
                local::checked(&source)?
                    .file_name()
                    .ok_or(SftpError::InvalidPath)?
                    .as_ref(),
            )?
        } else {
            paths::path(&source)?;
            source
                .rsplit('/')
                .next()
                .filter(|n| !n.is_empty())
                .ok_or(SftpError::InvalidPath)?
                .to_owned()
        };
        // Resolve the selected directory once; descendants must be actual directories, never links.
        let destination = if upload {
            client.canonicalize(&self.request.destination).await?
        } else {
            local::text(
                &tokio::fs::canonicalize(local::checked(&self.request.destination)?).await?,
            )?
        };
        let destination = if upload {
            paths::join(&destination, &name)?
        } else {
            local::child(&destination, &name)?
        };
        let mut stack = vec![(source, destination)];
        while let Some((source, destination)) = stack.pop() {
            self.check()?;
            self.current = source.clone();
            let (dir, file) = if upload {
                let m = tokio::fs::symlink_metadata(local::checked(&source)?).await?;
                (
                    m.is_dir() && !m.is_symlink(),
                    m.is_file() && !m.is_symlink(),
                )
            } else {
                let m = client.symlink_metadata(&source).await?;
                (
                    m.is_dir() && !m.is_symlink(),
                    m.is_regular() && !m.is_symlink(),
                )
            };
            if !dir && !file {
                return Err(SftpError::UnsupportedType);
            }
            let Some(destination) = self.destination(&destination, dir).await? else {
                continue;
            };
            if dir {
                if upload {
                    if remote::exists(client, &destination).await?.is_none() {
                        client.create_dir(&destination).await?;
                    }
                    let mut entries = tokio::fs::read_dir(local::checked(&source)?).await?;
                    while let Some(entry) = entries.next_entry().await? {
                        let name = entry
                            .file_name()
                            .into_string()
                            .map_err(|_| SftpError::InvalidPath)?;
                        stack.push((
                            local::text(&entry.path())?,
                            paths::join(&destination, &name)?,
                        ));
                    }
                } else {
                    if local::exists(&destination).await?.is_none() {
                        tokio::fs::create_dir(&destination).await?;
                    }
                    for entry in client.read_dir(&source).await? {
                        let name = entry.file_name();
                        stack.push((
                            paths::join(&source, &name)?,
                            local::child(&destination, &name)?,
                        ));
                    }
                }
            } else {
                self.copy_file(&source, &destination).await?;
            }
        }
        Ok(())
    }
    async fn destination(
        &self,
        desired: &str,
        directory: bool,
    ) -> Result<Option<String>, SftpError> {
        let upload = self.request.side == Side::Local;
        let mut candidate = desired.to_owned();
        let mut n = 0;
        loop {
            self.check()?;
            let existing = if upload {
                remote::exists(self.session.client()?, &candidate)
                    .await?
                    .map(|m| (m.is_dir(), m.is_regular(), m.is_symlink()))
            } else {
                local::exists(&candidate)
                    .await?
                    .map(|m| (m.is_dir(), m.is_file(), m.is_symlink()))
            };
            let Some((is_dir, is_file, link)) = existing else {
                return Ok(Some(candidate));
            };
            match self.request.conflict {
                Conflict::Ask => return Err(SftpError::Exists),
                Conflict::Skip => return Ok(None),
                Conflict::Replace => {
                    if link || directory != is_dir || (!directory && !is_file) {
                        return Err(SftpError::TypeConflict);
                    }
                    return Ok(Some(candidate));
                }
                Conflict::KeepBoth => {
                    n += 1;
                    let name = if upload {
                        desired.rsplit('/').next().ok_or(SftpError::InvalidPath)?
                    } else {
                        std::path::Path::new(desired)
                            .file_name()
                            .and_then(|s| s.to_str())
                            .ok_or(SftpError::InvalidPath)?
                    };
                    let name = paths::copy_name(name, n);
                    candidate = if upload {
                        let parent = desired.rsplit_once('/').ok_or(SftpError::InvalidPath)?.0;
                        paths::join(if parent.is_empty() { "/" } else { parent }, &name)?
                    } else {
                        local::text(&local::checked(desired)?.with_file_name(name))?
                    };
                }
            }
        }
    }
}
pub(crate) fn start_transfer(
    session: Arc<Session>,
    request: TransferRequest,
) -> Result<(), SftpError> {
    session.client()?;
    if request.id.is_empty() || request.id.len() > 80 {
        return Err(SftpError::InvalidPath);
    }
    paths::path(&request.source)?;
    paths::path(&request.destination)?;
    let token = session.cancel.child_token();
    {
        let mut jobs = session.jobs.lock_recovering();
        if !jobs.is_empty() {
            return Err(SftpError::TransferBusy);
        }
        jobs.insert(request.id.clone(), token.clone());
    }
    tauri::async_runtime::spawn(async move {
        let id = request.id.clone();
        let mut transfer = Transfer {
            session: &session,
            token,
            request,
            bytes: 0,
            current: String::new(),
            last: Instant::now(),
        };
        transfer.report("running", None);
        let _guard = session.operations.lock().await;
        let result = transfer.run().await;
        // Remove before reporting completion so the next queued request can start immediately.
        session.jobs.lock_recovering().remove(&id);
        match result {
            Ok(()) => transfer.report("completed", None),
            Err(SftpError::Cancelled) => transfer.report("cancelled", None),
            Err(e) => transfer.report(
                if matches!(e, SftpError::Exists) {
                    "conflict"
                } else {
                    "failed"
                },
                Some(coded("sftp", &e)),
            ),
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests;
