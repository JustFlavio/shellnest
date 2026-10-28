# Product roadmap

Goal: an open source SSH client for individual users on Windows and macOS, with reusable credentials and optional self-hosted sync. The initial use case is the daily management of about thirty servers. Feature parity between the two systems and full keyboard use are requirements.

## 1. Daily flow — implemented, visual verification pending

- [x] New tab `+` and `Ctrl/Cmd K`: search hosts, open tabs and saved recent connections.
- [x] Quick connect with an existing identity, without having to save a host; server key check before authenticating.
- [x] Interactive local terminal with a native PTY: input, resize and process exit.
- [x] Compact list and cards, preference remembered per vault; host action menu.
- [x] OS detected after a successful connection and saved in the vault; no upfront scan of the servers.
- [x] Several independent vaults, each with its own password, data and sync configuration; the existing local vault is preserved.
- [x] Tabs: state, reconnect, duplicate, reorder and close other sessions.
- [x] Automated tests for vault separation, migration, connection parsing, SSH and PTY.
- [x] UX review: destination and identity visible in tabs, selection separate from connecting, folders in navigation and a filter for small windows, protection of form edits and a shortcuts guide.
- [x] Flows checked in the browser preview on Windows: creating hosts/identities, returning to forms, multi-select, filters and search. The demo uses synthetic data, without SSH or encryption.
- [ ] Visual check in the desktop WebView on Windows and macOS; screen reader test and a full keyboard-flow check on both systems.

Boundaries: switching or locking a vault closes the sessions, after confirmation when there are any. Vault names are local metadata visible before unlocking; credentials stay encrypted. The initial recents are the saved hosts with a successful last access: commands and terminal output are never recorded. The sync service is personal, with no multi-user sharing.

Check of 25 October 2026 on Windows: TypeScript/Vite build succeeded, 21 Rust tests and 16 JavaScript tests passed, including SSH on localhost, PowerShell with a native PTY, vault isolation and sync between two simulated devices. The browser preview was checked visually; the desktop WebView and macOS checks are still open.

## 2. Import and protecting your work

- Import of `~/.ssh/config` with a preview, identity matching and duplicate handling.
- Hierarchical folders, breadcrumbs and inherited assignment with explicit exceptions.
- Favorites, environment labels and a clear Production marker in sessions.
- Guided encrypted backup/export and restore.
- Sync conflict resolution in the app and per-vault error state.
- Configurable auto-lock with a documented behavior for sessions.
- Remote system detection that can be corrected by hand, and a history of quick connections, if needed.

## 3. Later operational features

- SFTP, split terminals, port forwarding and saved workspaces.
- Snippets; broadcast only with clearly verifiable recipients.
- Code signing/notarization, macOS builds and tests, a security review before a stable release.

Not planned for the first release: serial, real-time collaboration, multi-user accounts and compatibility with third-party cloud services.

## Future ideas

- App settings to choose the fonts: one for the interface (today Geist) and one for the terminal (today Cascadia Code in `TerminalPane.tsx`), with a live preview.
