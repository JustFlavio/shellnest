# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Versions below 1.0.0 may change in incompatible ways.

## [0.1.2] - Unreleased

### Added

- Linux (Ubuntu, x86_64): a `.deb` and an AppImage. The unlock key can live in the Secret Service (GNOME Keyring, KWallet); without a running service the app asks for the password. Only the AppImage updates itself; with a `.deb` the update toast opens the download page. Not yet tried on a real desktop.
- A shortcut to open a new local terminal: `⌘L` on macOS, `Ctrl+Shift+L` elsewhere. Every press opens a new one, as many as you like in a row; it is listed in Settings → Shortcuts and can be rebound.

- README download table with links that always point at the newest installers (copies without the version in the name, added to each release), and `install.sh` for Linux: installs the AppImage for the user with a menu entry, after checking its checksum.

### Changed

- Releases are normal releases instead of pre-releases, and the app reads `releases/latest/download/latest.json`: the permanent `updater` release and its workflow are gone. Apps up to 0.1.2 still read the old place (see `docs/releases.md`).

### Fixed

- Dropdown menus and selects grow to fit their longest entry and its shortcut instead of the width of the button that opens them (on Linux "New host" wrapped and the folder shortcut was cut off).
- Side panels close with an X; a panel opened on top of another form (a key from an identity) has a back arrow before its title instead of a Back button, and the action button fills the footer.
- Right-clicking a terminal header no longer shows the webview's Reload menu.
- The tab bar follows the active tab: a new tab, previous/next tab, `⌘1–9` or a half-hidden tab scrolls it into view.
- The in-app update was found but its download was a 404: the download URLs in `latest.json` pointed at `releases/latest`, which skips pre-releases. They now point at the release tag.

### Changed

- The tab bar keeps the Vault tab and the `+` button fixed; only the session tabs scroll, with the scrollbar hidden and a fade on the edge that has hidden tabs.
- The shortcut labels call a split area "panel" in English and "pannello" in Italian, not "pane".
- The README explains the download and the first launch of the unsigned builds.

## [0.1.1] - 2026-10-29

First update delivered through the in-app updater.

### Changed

- Dependencies: `russh` 0.65, `base64` 0.23, `nix` 0.31, `tauri-plugin-updater` 2.14.1 and, through it, `zip` 9.1.3 (the 4.x line had a critical advisory).
- CI: `actions/checkout` 7.0.1 and `actions/setup-node` 7.1.0, still pinned by SHA.

## [0.1.0] - 2026-10-29

First public alpha, not audited and not code-signed.

### Added

- Encrypted local vaults (Argon2id + XChaCha20-Poly1305), several independent vaults and an optional unlock key in the system keychain.
- Hosts, nested folders, reusable identities and an SSH key store; search, multi-select and a quick-connect launcher (`Ctrl/Cmd K`) with open tabs, saved hosts and typed targets.
- SSH terminals in tabs with split panes (russh, native PTY), host key verification on first access and a hard stop when it changes.
- A connection timeline with step outcomes, an inline password prompt when key authentication is refused, a retry cap and a readable connection log.
- Local terminal, terminal themes, fonts and rebindable keyboard shortcuts.
- Automatic update check with in-app install (signed with a Tauri updater key).
- Optional sync of the encrypted vault through the self-hosted Node.js server in `sync/` (experimental).
- English and Italian interface, chosen from the system language or in Settings → General.

### Known limitations

- No SFTP, port forwarding, jump hosts, agent forwarding or keyboard-interactive/2FA.
- Quick connections do not remember the server fingerprint.
- Sync between devices has not been tested against a real remote deployment.
- The default vault of a new installation is named "Personal"; an existing vault keeps the name it has.
- A notification or a form error that is already on screen keeps the language it was produced in when the language changes.
