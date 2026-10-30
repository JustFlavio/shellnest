//! A real SFTP protocol peer over an in-process stream, with controllable publication failures.
use crate::locks::MutexExt;
use russh_sftp::{client::SftpSession, protocol::*, server};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};
use tokio::sync::Notify;

#[derive(Clone)]
pub(super) enum Node {
    Directory,
    File(Vec<u8>),
}
#[derive(Clone, Default)]
pub(super) struct Fixture {
    pub nodes: Arc<Mutex<BTreeMap<String, Node>>>,
    pub fail_publication: Arc<AtomicUsize>,
    pub wrote: Arc<Notify>,
    pub delay_write: bool,
}
impl Fixture {
    pub async fn connect(&self) -> SftpSession {
        self.nodes
            .lock_recovering()
            .insert("/".into(), Node::Directory);
        let (client, peer) = tokio::io::duplex(128 * 1024);
        let handler = Handler {
            fixture: self.clone(),
            handles: HashMap::new(),
            read_dirs: HashSet::new(),
        };
        tokio::spawn(server::run(peer, handler));
        SftpSession::new(client).await.unwrap()
    }
    pub fn bytes(&self, path: &str) -> Vec<u8> {
        match self.nodes.lock_recovering().get(path).unwrap() {
            Node::File(bytes) => bytes.clone(),
            Node::Directory => panic!("not a file"),
        }
    }
}
struct Handler {
    fixture: Fixture,
    handles: HashMap<String, String>,
    read_dirs: HashSet<String>,
}
fn ok(id: u32) -> Status {
    Status {
        id,
        status_code: StatusCode::Ok,
        error_message: String::new(),
        language_tag: String::new(),
    }
}
fn attributes(node: &Node) -> FileAttributes {
    FileAttributes {
        size: match node {
            Node::File(bytes) => Some(bytes.len() as u64),
            _ => None,
        },
        permissions: Some(match node {
            Node::Directory => 0o40755,
            Node::File(_) => 0o100600,
        }),
        ..Default::default()
    }
}
impl Handler {
    fn attrs(&self, id: u32, path: &str) -> Result<Attrs, StatusCode> {
        self.fixture
            .nodes
            .lock_recovering()
            .get(path)
            .map(|node| Attrs {
                id,
                attrs: attributes(node),
            })
            .ok_or(StatusCode::NoSuchFile)
    }
}
impl server::Handler for Handler {
    type Error = StatusCode;
    fn unimplemented(&self) -> StatusCode {
        StatusCode::OpUnsupported
    }
    async fn realpath(&mut self, id: u32, path: String) -> Result<Name, StatusCode> {
        let path = if path == "." { "/".to_owned() } else { path };
        self.attrs(id, &path)?;
        Ok(Name {
            id,
            files: vec![File::dummy(path)],
        })
    }
    async fn lstat(&mut self, id: u32, path: String) -> Result<Attrs, StatusCode> {
        self.attrs(id, &path)
    }
    async fn setstat(
        &mut self,
        id: u32,
        path: String,
        _: FileAttributes,
    ) -> Result<Status, StatusCode> {
        self.attrs(id, &path)?;
        Ok(ok(id))
    }
    async fn stat(&mut self, id: u32, path: String) -> Result<Attrs, StatusCode> {
        self.attrs(id, &path)
    }
    async fn fstat(&mut self, id: u32, handle: String) -> Result<Attrs, StatusCode> {
        self.attrs(id, self.handles.get(&handle).ok_or(StatusCode::Failure)?)
    }
    async fn open(
        &mut self,
        id: u32,
        filename: String,
        flags: OpenFlags,
        _: FileAttributes,
    ) -> Result<Handle, StatusCode> {
        let mut nodes = self.fixture.nodes.lock_recovering();
        if flags.contains(OpenFlags::CREATE) {
            if nodes.contains_key(&filename) && flags.contains(OpenFlags::EXCLUDE) {
                return Err(StatusCode::Failure);
            }
            nodes
                .entry(filename.clone())
                .or_insert_with(|| Node::File(Vec::new()));
        }
        if !matches!(nodes.get(&filename), Some(Node::File(_))) {
            return Err(StatusCode::NoSuchFile);
        }
        let handle = format!("f{id}");
        self.handles.insert(handle.clone(), filename);
        Ok(Handle { id, handle })
    }
    async fn read(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        len: u32,
    ) -> Result<Data, StatusCode> {
        let nodes = self.fixture.nodes.lock_recovering();
        let path = self.handles.get(&handle).ok_or(StatusCode::Failure)?;
        let Some(Node::File(bytes)) = nodes.get(path) else {
            return Err(StatusCode::Failure);
        };
        let offset = offset as usize;
        if offset >= bytes.len() {
            return Err(StatusCode::Eof);
        }
        Ok(Data {
            id,
            data: bytes[offset..bytes.len().min(offset + len as usize)].to_vec(),
        })
    }
    async fn write(
        &mut self,
        id: u32,
        handle: String,
        offset: u64,
        data: Vec<u8>,
    ) -> Result<Status, StatusCode> {
        self.fixture.wrote.notify_one();
        if self.fixture.delay_write {
            tokio::time::sleep(Duration::from_millis(30)).await;
        }
        let mut nodes = self.fixture.nodes.lock_recovering();
        let path = self.handles.get(&handle).ok_or(StatusCode::Failure)?;
        let Some(Node::File(bytes)) = nodes.get_mut(path) else {
            return Err(StatusCode::Failure);
        };
        let offset = offset as usize;
        bytes.resize(bytes.len().max(offset + data.len()), 0);
        bytes[offset..offset + data.len()].copy_from_slice(&data);
        Ok(ok(id))
    }
    async fn close(&mut self, id: u32, handle: String) -> Result<Status, StatusCode> {
        self.handles.remove(&handle);
        Ok(ok(id))
    }
    async fn opendir(&mut self, id: u32, path: String) -> Result<Handle, StatusCode> {
        if !matches!(
            self.fixture.nodes.lock_recovering().get(&path),
            Some(Node::Directory)
        ) {
            return Err(StatusCode::NoSuchFile);
        }
        let handle = format!("d{id}");
        self.handles.insert(handle.clone(), path);
        Ok(Handle { id, handle })
    }
    async fn readdir(&mut self, id: u32, handle: String) -> Result<Name, StatusCode> {
        if !self.read_dirs.insert(handle.clone()) {
            return Err(StatusCode::Eof);
        }
        let path = self.handles.get(&handle).ok_or(StatusCode::Failure)?;
        let prefix = format!("{}/", path.trim_end_matches('/'));
        let files = self
            .fixture
            .nodes
            .lock_recovering()
            .iter()
            .filter_map(|(p, node)| {
                let name = p.strip_prefix(&prefix)?;
                if name.is_empty() || name.contains('/') {
                    return None;
                }
                Some(File::new(name, attributes(node)))
            })
            .collect();
        Ok(Name { id, files })
    }
    async fn mkdir(
        &mut self,
        id: u32,
        path: String,
        _: FileAttributes,
    ) -> Result<Status, StatusCode> {
        let mut nodes = self.fixture.nodes.lock_recovering();
        if nodes.contains_key(&path) {
            return Err(StatusCode::Failure);
        }
        nodes.insert(path, Node::Directory);
        Ok(ok(id))
    }
    async fn rename(&mut self, id: u32, old: String, new: String) -> Result<Status, StatusCode> {
        let failures = self.fixture.fail_publication.load(Ordering::SeqCst);
        if failures > 0 && (old.ends_with(".part") || (failures > 1 && old.ends_with(".backup"))) {
            return Err(StatusCode::Failure);
        }
        let mut nodes = self.fixture.nodes.lock_recovering();
        if nodes.contains_key(&new) {
            return Err(StatusCode::Failure);
        }
        let node = nodes.remove(&old).ok_or(StatusCode::NoSuchFile)?;
        nodes.insert(new, node);
        Ok(ok(id))
    }
    async fn remove(&mut self, id: u32, path: String) -> Result<Status, StatusCode> {
        self.fixture
            .nodes
            .lock_recovering()
            .remove(&path)
            .ok_or(StatusCode::NoSuchFile)?;
        Ok(ok(id))
    }
    async fn rmdir(&mut self, id: u32, path: String) -> Result<Status, StatusCode> {
        let mut nodes = self.fixture.nodes.lock_recovering();
        if nodes.keys().any(|p| p.starts_with(&format!("{path}/"))) {
            return Err(StatusCode::Failure);
        }
        nodes.remove(&path).ok_or(StatusCode::NoSuchFile)?;
        Ok(ok(id))
    }
}
