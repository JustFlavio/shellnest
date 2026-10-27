use crate::{
    locks::MutexExt,
    terminal::{Input, Output, TerminalError},
};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    thread,
    time::Duration,
};
use tokio::sync::mpsc;

type Killers = HashMap<String, Box<dyn ChildKiller + Send + Sync>>;
static CHILDREN: OnceLock<Mutex<Killers>> = OnceLock::new();
fn children() -> &'static Mutex<Killers> {
    CHILDREN.get_or_init(|| Mutex::new(HashMap::new()))
}

pub(crate) fn shell_command() -> CommandBuilder {
    #[cfg(windows)]
    let mut command = {
        let root = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
        let program =
            std::path::PathBuf::from(root).join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let mut command = CommandBuilder::new(program);
        command.arg("-NoLogo");
        command
    };
    #[cfg(unix)]
    let mut command = {
        let program = std::env::var_os("SHELL")
            .filter(|s| std::path::Path::new(s).is_absolute())
            .unwrap_or_else(|| "/bin/sh".into());
        let mut command = CommandBuilder::new(program);
        command.arg("-l");
        command
    };
    if let Some(home) = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }) {
        if std::path::Path::new(&home).is_dir() {
            command.cwd(home);
        }
    }
    command.env("TERM", "xterm-256color");
    command
}
fn size(cols: u32, rows: u32) -> PtySize {
    PtySize {
        cols: cols.clamp(1, 1000) as u16,
        rows: rows.clamp(1, 1000) as u16,
        pixel_width: 0,
        pixel_height: 0,
    }
}

// The controller owns the PTY and child; its channel closes when the app drops the session.
pub(crate) fn start(
    id: String,
    command: CommandBuilder,
    cols: u32,
    rows: u32,
    sink: Arc<dyn Fn(Output) -> bool + Send + Sync>,
) -> Result<mpsc::UnboundedSender<Input>, TerminalError> {
    let pair = native_pty_system()
        .openpty(size(cols, rows))
        .map_err(TerminalError::pty)?;
    let mut reader = pair.master.try_clone_reader().map_err(TerminalError::pty)?;
    let mut writer = pair.master.take_writer().map_err(TerminalError::pty)?;
    #[cfg(unix)]
    let poll_fd = {
        use std::os::fd::{FromRawFd, OwnedFd};
        let fd = pair
            .master
            .as_raw_fd()
            .ok_or(TerminalError::NoPtyDescriptor)?;
        let duplicate = nix::fcntl::fcntl(fd, nix::fcntl::FcntlArg::F_DUPFD_CLOEXEC(0))?;
        // SAFETY: `duplicate` was just returned by a successful F_DUPFD_CLOEXEC, so it is a valid open
        // descriptor that no other owner has: wrapping it in an `OwnedFd` makes this the only closer.
        unsafe { OwnedFd::from_raw_fd(duplicate) }
    };
    let mut registry = children().lock_recovering();
    if registry.contains_key(&id) {
        return Err(TerminalError::LocalSessionOpen);
    }
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(TerminalError::pty)?;
    registry.insert(id.clone(), child.clone_killer());
    drop(registry);
    drop(pair.slave);
    let (tx, mut rx) = mpsc::unbounded_channel();
    let failed = Arc::new(AtomicBool::new(false));
    let read_failed = failed.clone();
    let closing = Arc::new(AtomicBool::new(false));
    let read_closing = closing.clone();
    let read_sink = sink.clone();
    let reader_thread = thread::spawn(move || {
        let mut buffer = [0; 16384];
        loop {
            if read_closing.load(Ordering::Acquire) {
                break;
            }
            #[cfg(unix)]
            {
                use std::os::fd::AsFd;
                let mut fds = [nix::poll::PollFd::new(
                    poll_fd.as_fd(),
                    nix::poll::PollFlags::POLLIN,
                )];
                match nix::poll::poll(&mut fds, 100u16) {
                    Ok(0) => continue,
                    Ok(_) => {}
                    Err(nix::errno::Errno::EINTR) => continue,
                    Err(_) => break,
                }
                if read_closing.load(Ordering::Acquire) {
                    break;
                }
            }
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    if !read_sink(Output::Data(buffer[..n].to_vec())) {
                        read_failed.store(true, Ordering::Release);
                        break;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
        read_failed.store(true, Ordering::Release);
    });
    thread::spawn(move || {
        let _ = sink(Output::Status("Connesso".into()));
        let result = (|| -> Result<(), TerminalError> {
            loop {
                if failed.load(Ordering::Acquire) {
                    break;
                }
                match rx.try_recv() {
                    Ok(Input::Data(bytes)) => {
                        writer.write_all(&bytes).and_then(|()| writer.flush())?
                    }
                    Ok(Input::Resize(cols, rows)) => pair
                        .master
                        .resize(size(cols, rows))
                        .map_err(TerminalError::pty)?,
                    Ok(Input::Close) | Err(mpsc::error::TryRecvError::Disconnected) => break,
                    // Nothing here asks for a password: an answer never reaches the shell.
                    Ok(Input::Password(_)) | Err(mpsc::error::TryRecvError::Empty) => {}
                }
                if child.try_wait()?.is_some() {
                    return Ok(());
                }
                thread::sleep(Duration::from_millis(10));
            }
            let _ = child.kill();
            let _ = child.wait();
            Ok(())
        })();
        if result.is_err() {
            let _ = child.kill();
            let _ = child.wait();
        }
        children().lock_recovering().remove(&id);
        closing.store(true, Ordering::Release);
        drop(writer);
        drop(pair.master);
        let _ = reader_thread.join();
        if let Err(error) = result {
            let _ = sink(Output::Error(error.to_string()));
        }
        let _ = sink(Output::Closed);
    });
    Ok(tx)
}

pub(crate) fn shutdown_all() {
    for (_, mut child) in children().lock_recovering().drain() {
        let _ = child.kill();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn test_shell() -> CommandBuilder {
        #[cfg(windows)]
        {
            let root = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
            let mut cmd = CommandBuilder::new(
                std::path::PathBuf::from(root)
                    .join("System32/WindowsPowerShell/v1.0/powershell.exe"),
            );
            cmd.args(["-NoLogo", "-NoProfile"]);
            cmd
        }
        #[cfg(unix)]
        {
            CommandBuilder::new("/bin/sh")
        }
    }
    #[test]
    fn native_pty_accepts_input_resize_and_closes_child() {
        let id = format!("test-local-{}", rand::random::<u64>());
        let (events, receiver) = std::sync::mpsc::channel();
        let tx = start(
            id.clone(),
            test_shell(),
            80,
            24,
            Arc::new(move |event| events.send(event).is_ok()),
        )
        .unwrap();
        tx.send(Input::Resize(110, 35)).unwrap();
        #[cfg(windows)]
        let input = "Write-Output ('PTY_' + 'TEST_OK_' + [Console]::WindowWidth)\r";
        #[cfg(unix)]
        let input = "printf 'PTY_%s_' 'TEST_OK'; stty size\n";
        #[cfg(windows)]
        let expected = "PTY_TEST_OK_110";
        #[cfg(unix)]
        let expected = "PTY_TEST_OK_35 110";
        tx.send(Input::Data(input.as_bytes().to_vec())).unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(20);
        let mut bytes = Vec::new();
        let mut answered_cursor = false;
        while std::time::Instant::now() < deadline {
            match receiver.recv_timeout(Duration::from_millis(200)) {
                Ok(Output::Data(data)) => {
                    bytes.extend(data);
                    if !answered_cursor && bytes.windows(4).any(|w| w == b"\x1b[6n") {
                        answered_cursor = true;
                        tx.send(Input::Data(b"\x1b[1;1R".to_vec())).unwrap();
                    }
                    if String::from_utf8_lossy(&bytes).contains(expected) {
                        break;
                    }
                }
                Ok(Output::Error(error)) => panic!("Local PTY failed: {error}"),
                _ => {}
            }
        }
        tx.send(Input::Close).unwrap();
        assert!(
            String::from_utf8_lossy(&bytes).contains(expected),
            "Shell did not execute test input: {:?}",
            String::from_utf8_lossy(&bytes)
        );
        loop {
            match receiver.recv_timeout(Duration::from_secs(10)).unwrap() {
                Output::Closed => break,
                Output::Error(error) => panic!("Close failed: {error}"),
                _ => {}
            }
        }
        assert!(!children().lock().unwrap().contains_key(&id));
    }
    #[cfg(unix)]
    #[test]
    fn close_does_not_wait_for_a_descendant_holding_the_slave() {
        let mut command = CommandBuilder::new("/bin/sh");
        command.args([
            "-c",
            "trap '' HUP; sleep 3 & printf 'PTY_DESCENDANT_READY\\n'; wait",
        ]);
        let id = format!("test-unix-descendant-{}", rand::random::<u64>());
        let (events, receiver) = std::sync::mpsc::channel();
        let tx = start(
            id,
            command,
            80,
            24,
            Arc::new(move |event| events.send(event).is_ok()),
        )
        .unwrap();
        let mut bytes = Vec::new();
        loop {
            if let Output::Data(data) = receiver.recv_timeout(Duration::from_secs(2)).unwrap() {
                bytes.extend(data);
                if String::from_utf8_lossy(&bytes).contains("PTY_DESCENDANT_READY") {
                    break;
                }
            }
        }
        let started = std::time::Instant::now();
        tx.send(Input::Close).unwrap();
        loop {
            if matches!(
                receiver.recv_timeout(Duration::from_secs(2)).unwrap(),
                Output::Closed
            ) {
                break;
            }
        }
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "Reader waited for the unrelated descendant instead of closing its own PTY"
        );
    }
}
