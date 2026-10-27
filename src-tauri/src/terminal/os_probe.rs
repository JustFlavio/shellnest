//! Best-effort detection of the remote OS over a second channel, bounded in time and size.
use russh::{client, ChannelMsg};
use std::time::Duration;

use super::host_key::Handler;

pub(super) const OS_PROBE: &str = "cat /etc/os-release 2>/dev/null || uname -s";
pub(super) async fn detect_os(session: &client::Handle<Handler>) -> Option<String> {
    let mut channel =
        tokio::time::timeout(Duration::from_millis(750), session.channel_open_session())
            .await
            .ok()?
            .ok()?;
    let result = tokio::time::timeout(Duration::from_secs(2), async {
        channel.exec(true, OS_PROBE).await.ok()?;
        let mut bytes = Vec::new();
        while let Some(message) = channel.wait().await {
            match message {
                ChannelMsg::Data { data } => {
                    if bytes.len() + data.len() > 8192 {
                        return None;
                    }
                    bytes.extend_from_slice(&data);
                }
                ChannelMsg::Failure => return None,
                ChannelMsg::Eof | ChannelMsg::Close => break,
                _ => {}
            }
        }
        parse_os(&bytes)
    })
    .await
    .ok()
    .flatten();
    let _ = tokio::time::timeout(Duration::from_millis(250), channel.close()).await;
    result
}
fn parse_os(bytes: &[u8]) -> Option<String> {
    if bytes.len() > 8192 {
        return None;
    }
    let text = std::str::from_utf8(bytes).ok()?;
    if let Some(value) = text
        .lines()
        .find_map(|line| line.trim().strip_prefix("ID="))
    {
        let id = value.trim().trim_matches(['\"', '\'']);
        if !id.is_empty()
            && id.len() <= 32
            && id
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, b'-' | b'_'))
        {
            return Some(id.into());
        }
        return None;
    }
    match text.trim() {
        "Linux" => Some("linux".into()),
        "Darwin" => Some("macos".into()),
        "FreeBSD" => Some("freebsd".into()),
        "OpenBSD" => Some("openbsd".into()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn os_metadata_is_bounded_and_never_includes_arbitrary_remote_text() {
        assert_eq!(
            parse_os(b"NAME=Ubuntu\nID=ubuntu\n").as_deref(),
            Some("ubuntu")
        );
        assert_eq!(parse_os(b"ID=\"debian\"\n").as_deref(), Some("debian"));
        assert_eq!(parse_os(b"Darwin\n").as_deref(), Some("macos"));
        assert!(parse_os(b"ID=ubuntu;rm -rf /\n").is_none());
        assert!(parse_os(&vec![b'x'; 8193]).is_none());
        assert!(parse_os(&[255]).is_none());
    }
}
