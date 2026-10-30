# SFTP files and transfers

Each SSH pane offers **Terminal / Files**. Files shows the device on the left and the server on the right. Switching views keeps the shell mounted and transfers running. **Open files (SFTP)** in a saved host's menu opens Files without starting a shell. The configurable **Switch Terminal / Files** shortcut uses Cmd+E on macOS and Ctrl+Shift+E elsewhere by default.

Each side has its own directory, history, editable path, breadcrumbs, hidden-file toggle, filter and selection. Use checkboxes, Ctrl/Cmd-click or Shift-click to select files. Double-click a directory or press Enter on its name to open it. Arrow keys move through names. Upload/Download buttons work without dragging. Dragging between the two panes copies the selected entries to the other pane's current directory. The divider supports both pointer dragging and arrow keys.

## Transfer behavior

- Regular files and directories copy in both directions, including empty and hidden directories. Data streams through Rust; the frontend receives metadata and progress, never file contents.
- A session runs one transfer at a time. Each selected entry is a separate queue item. Failed items retain their error and can be retried; unrelated items continue. A conflict pauses the queue for an explicit choice.
- **Replace** merges an existing directory and replaces matching regular files. **Skip existing** skips an existing entry and its subtree. **Keep both** finds a new numbered name. Choices apply to the selected queue item, including its descendants.
- Files are staged beside the destination before publication. Downloads use a platform no-clobber publication operation unless replacement was explicitly chosen. SFTP v3 rename protects a new remote name from replacement.
- Replacing a remote file first moves the original to a unique backup. Failed publication restores it; if restoration fails, the error reports the retained recovery path. Existing file permissions are retained on replacement where the destination supports them. New remote files start with private permissions (0600).
- Cancellation preserves existing destination files. Files already completed and directories already created remain. Cleanup removes staging files when the connection permits it; a lost connection can leave a `.shellnest-*.part` file. A recovery error can leave an explicitly reported `.backup` file.
- Closing the pane, locking the vault or changing vaults cancels queued and active transfers. Cancellation permits an already-started publication/rollback to finish before disconnecting. Nothing is resumed automatically after restarting the app.
- The initial remote directory is the account's SFTP home. The current shell directory is not inferred from prompt text. Paths are retained while the Files session remains open.

Symbolic links can be browsed, renamed and deleted, but are not followed during recursive transfers. A transfer containing links or special files stops with an explicit error, preserving completed files. This avoids copying files outside the selected tree or creating recursive cycles. Non-UTF-8 names and names unsupported by the destination filesystem produce an error. Ownership, timestamps and complete filesystem metadata are not mirrored. Files is a transfer browser, not a directory synchronization or diff tool.

## Ownership

- `ssh/`: shared host-key verification and authentication. No shell or SFTP operations.
- `terminal/connection.rs`: PTY and shell establishment on the authenticated transport.
- `sftp/session.rs`: independent SFTP transport, password prompts, cancellation and vault-scoped registration. It shares the session close registry and connection timeout/prompt behavior with terminal sessions. Shell closure does not own its lifetime. The destination is checked against the pane snapshot, so editing an open host cannot silently redirect Files to a different server or account.
- `sftp/local.rs`, `remote.rs`, `paths.rs`: filesystem operations and boundary validation. `files.rs` dispatches operations by side.
- `sftp/transfer.rs` and `transfer/`: traversal, streaming, conflicts, staging and publication. A session operation mutex serializes mutations and transfers.
- `commands/sftp.rs`: IPC arguments and vault checks. Secret resolution stays in the existing model; connection credentials are dropped immediately after authentication.
- `features/sftp/`: separate browser state, file toolbar/list/actions, session subscription and transfer queue controller. `TerminalPane` only selects and mounts views.
- `lib/preview/sftp.ts`: synthetic in-memory files for browser demos; no device or network access.

## Verification

Rust tests exchange actual SFTP packets with an in-process server to check recursive upload/download, hidden files, conflict choices, cancellation while streaming and failed-publication recovery. Additional tests check local publication, path validation and vault shutdown. TypeScript tests cover selection, navigation paths, queue ordering, conflict suspension, cancellation, stale events and preview operations.

Before release, verify the desktop against real SFTP servers on Windows and macOS, including a server without SFTP enabled, password fallback, large files, non-ASCII names, permission errors, disconnected networks and transfers interrupted by vault locking. Protocol fixtures do not substitute for these platform checks.

Run the functional browser checks with `npm run test:sftp` (install Chromium once with `npx playwright install chromium --only-shell`). They use a fresh preview server and test shell preservation, background transfers, conflict choices, filtered selection, file actions, directory drag-and-drop and a narrow viewport. Existing platform-specific visual snapshots are not regenerated by this command.
