use super::{SftpError, local, remote, session::Session};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Side {
    Local,
    Remote,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Entry {
    pub name: String,
    pub path: String,
    pub kind: &'static str,
    pub size: Option<u64>,
    pub modified: Option<u64>,
    pub hidden: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Directory {
    pub path: String,
    pub parent: Option<String>,
    pub roots: Vec<String>,
    pub entries: Vec<Entry>,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum Mutation {
    Mkdir { parent: String, name: String },
    Rename { path: String, name: String },
    Delete { paths: Vec<String> },
}

impl Session {
    pub(crate) async fn list(&self, side: Side, path: &str) -> Result<Directory, SftpError> {
        let client = self.client()?;
        self.cancellable(async {
            match side {
                Side::Local => local::list(path).await,
                Side::Remote => remote::list(client, path).await,
            }
        })
        .await
    }
    pub(crate) async fn mutate(&self, side: Side, mutation: Mutation) -> Result<(), SftpError> {
        let client = self.client()?;
        // Serializes mutations with transfers, including publication of completed files.
        let _guard = self
            .cancellable(async { Ok(self.operations.lock().await) })
            .await?;
        self.cancellable(async {
            match side {
                Side::Local => local::mutate(mutation).await,
                Side::Remote => remote::mutate(client, mutation).await,
            }
        })
        .await
    }
}
