# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Versions below 1.0.0 may change in incompatible ways.

## [0.1.0] - Unreleased

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
