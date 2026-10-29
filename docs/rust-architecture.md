# Rust backend architecture

The backend lives in `src-tauri/src/` (crate `shellnest_lib`). This page explains how it is layered and the rules that keep it safe. The module list is in `AGENTS.md`.

## Layers

```
commands/   Tauri commands: validate arguments, take the locks, call the layers below
state.rs    AppState (open vault, catalog, sessions) and commit(): persist, then swap
model/      the decrypted vault contents and the rules that keep them consistent (pure, no I/O)
vault/      encryption, the on-disk envelope, atomic saves, the vault catalog
keychain/   the vault key in the OS keychain
sync.rs     blocking HTTP client for the optional sync server
terminal/   SSH sessions (russh); local.rs is the local PTY
view.rs     the secret-free snapshot returned to the UI
```

Dependencies point down: `model` knows nothing about files or the network, `vault` knows nothing about SSH. Every command that changes the vault goes through `commands::mutate`, which edits a **copy** of the data, validates and seals it, writes it to disk, and only then replaces the in-memory vault. A failed edit or write leaves memory and disk untouched.

## Error model

Each area owns an error enum built with `thiserror`: `ModelError`, `VaultError`, `KeychainError`, `SyncError`, `TerminalError`. `error::Error` wraps them (plus the lock and "vault locked/switched" cases) and is what commands return.

`Error` serializes as `{ "code": "model.HostNotFound", "params": … }`: the area enums derive `Serialize` (adjacently tagged) and `error::coded` prefixes the code with the area. A one-field variant sends its value as `params`; a variant wrapping a library error sends its text. The UI translates `error.<code>` (`src/locales/`). `Display` texts are English and only for logs and tests. The connection log, timeline steps and stages use the same shape (`message::msg!`). A new variant needs its key in every locale. Internal code never builds an error from a `String`.

Poisoned mutexes have one policy (`locks.rs`):

- the vault and the catalog report `Error::StatePoisoned` / `CatalogPoisoned` (`AppState::vault`, `AppState::catalog`);
- plain registries (open sessions, local children, the pending password question) are taken as they are with `lock_recovering`. A poisoned session map must not stop `lock` from closing sessions.

Production code has no `unwrap()`; the one `expect` is in `run()` and ends the app when Tauri cannot start. Tests may unwrap.

## Secret rules

- Keys, passwords, passphrases and tokens live in types that are `ZeroizeOnDrop` (`Data`, `Host`, `HostCredentials`, `Identity`, `SshKey`, `Connection`) or in `Zeroizing` (`OpenVault::key`, `Input::Password`, command arguments right after they are received).
- Those types have a redacted `Debug` (`model::Redacted`), never a derived one, and tests assert that `{:?}` does not contain the secret. `Input` shows only the size of keystrokes.
- Secrets never appear in error text, in `Output::Log` lines or in `View`. `view.rs` exposes `has_password` booleans, never values.
- The vault format is fixed: `AAD` in `vault/mod.rs` and the envelope never change without a migration.

## The SSH session

`terminal::register` creates an unbounded input channel, stores its sender in `AppState::sessions` and spawns one task, `session::run`. The UI sends `Input` through `send`; `Output` goes back through a Tauri `Channel`. The channel is unbounded on purpose: producers are IPC calls from a single user (keystrokes, capped at 64 KiB each), and there is no way to make an IPC command wait.

`run` has two phases:

1. `connection::open` connects, checks the host key against the saved fingerprint, then authenticates: key, saved password, then asking the user (at most three typed passwords). `session::until_open` drives it under a 30 s timeout that is held while a password question is open and starts over once it is answered. A `Close` input, or a closed channel, cancels it by dropping the future.
2. The pump: one `select!` over input (data, resize, close) and channel messages, plus the one-shot OS detection.

**The password prompt** (`password.rs`) is a one-slot mailbox. `open` calls `ask`, which stores a `oneshot` sender and wakes `until_open` (`Notify`); the UI shows the question and answers with `terminal_password`, which arrives as `Input::Password`; `until_open` hands it to `answer`. An answer when no question is open is dropped, and zeroized with it.

`Closing` (a drop guard in `session.rs`) sends `Output::Closed` and removes the registry entry however the task ends, a panic included. `lock`, switching or deleting a vault drain `AppState::sessions` and send `Close` to each; the app closing calls `local::shutdown_all`.

## Threads

Tauri runs a command without `async` on the main thread. Commands that can wait (the vault lock is held across HTTP during a sync), touch the disk or the keychain are `#[tauri::command(async)]` or `async` with `spawn_blocking` (Argon2, keychain, blocking HTTP). Terminal input, resize, password and disconnect stay synchronous: they only take the catalog lock and must stay in order.

## Tests

Unit tests sit in `#[cfg(test)] mod tests` beside the code. Larger pieces:

- `terminal/test_server.rs`: an in-process russh server used by the auth tests in `connection.rs` (password, key, refused key, retries, changed host key, shell refused).
- `sync.rs`: two devices against the real `sync/server.ts` started with Node.
- `local.rs`: a real PTY with `/bin/sh` (PowerShell on Windows).
- `model/test_support.rs`, `test_support.rs`: builders and a temporary vault directory.

Not covered automatically: a real SSH server, the OS keychain, the PTY on Windows.
