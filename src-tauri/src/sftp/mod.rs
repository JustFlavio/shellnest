//! Vault-scoped SFTP sessions, file operations and streaming transfers.
mod error;
mod files;
mod local;
mod paths;
mod remote;
mod session;
mod target;
mod transfer;
pub(crate) use error::SftpError;
pub(crate) use files::{Directory, Mutation, Side};
pub(crate) use session::{Event, Registry, close, close_all, get, open};
pub(crate) use target::ExpectedTarget;
pub(crate) use transfer::{TransferRequest, start_transfer};

#[cfg(test)]
mod test_server;
