# Dependency refresh for 0.1.4

Verified against main `f884764` on 2026-10-30; its post-merge CI passed.
Package versions below are resolved lockfile versions, not just manifest ranges.
The application version stays 0.1.3 until release approval.

## Frontend and desktop test tooling

| Family                                            | Before                  | Selected stable version          |
| ------------------------------------------------- | ----------------------- | -------------------------------- |
| React / React DOM                                 | 19.3.1                  | 19.3.1 (already current)         |
| React types / DOM types                           | 19.3.0                  | 19.3.0 (already current)         |
| Vite                                              | 6.4.5                   | 8.3.5                            |
| TypeScript                                        | 5.9.3                   | 6.0.3                            |
| xterm / fit                                       | 5.5.0 / 0.10.0          | 6.0.0 / 0.11.0                   |
| xterm search / Unicode 11 / web links             | 0.16.0 / 0.9.0 / 0.12.0 | unchanged, current stable addons |
| Lucide React                                      | 0.468.0                 | 1.65.0                           |
| i18next                                           | 26.5.11                 | 26.5.12                          |
| Tauri JS API / CLI                                | 2.12.4                  | 2.12.4 (already current)         |
| Tauri updater JS                                  | 2.14.0                  | 2.14.1                           |
| Knip                                              | 6.43.0                  | 6.44.0                           |
| ESLint / @eslint/js                               | 9.39.5                  | 9.39.5                           |
| typescript-eslint / hooks / accessibility plugins | 8.72.1 / 7.1.1 / 6.10.2 | unchanged                        |
| WDIO CLI / runner / Mocha / reporter              | 9.32.0                  | 9.32.0                           |
| WDIO globals / Tauri service / Tauri plugin       | 9.31.3 / 1.5.1 / 1.5.1  | unchanged                        |
| Tailwind / Vite plugin                            | 4.3.3                   | 4.3.3 (already current)          |
| Playwright / Prettier                             | 1.64.1 / 3.9.10         | unchanged, already current       |

Other direct dependencies are already on their latest stable releases. Node types
stay on the supported Node 24 line, matching the sync server image; `.nvmrc`
still selects Node 22.18, which meets the selected tools' requirements.

Compatibility limits verified through published npm peer and engine metadata:

- TypeScript 7.0.2 is stable, but typescript-eslint 8.72.1 requires TypeScript
  `>=4.8.4 <6.1.0`; 6.0.3 is the latest supported stable compiler.
- ESLint 10.14.0 and @eslint/js 10.0.1 are stable, but
  eslint-plugin-jsx-a11y 6.10.2 only supports ESLint through 9. Keep the complete
  ESLint 9 family until the accessibility plugin supports 10.
- WDIO 10.1.0 requires Node >=22.19 and its globals require webdriverio 10.
  @wdio/tauri-service 1.5.1 requires webdriverio `^9.0.0`. Keep all WDIO members
  on 9 until a compatible Tauri service exists; do not force peer conflicts.

## Migration and rollback

The frontend reads the same Tauri command snapshots and preferences and writes
through the existing commands. No persisted shape or command contract changes.
Reverting this PR's manifest, lockfile and compiler/build configuration restores
the old toolchain; run `npm ci` after either direction.

[Vite's migration guide](https://vite.dev/guide/migration) covers the Rolldown
bundler and newer default browser baseline. The build explicitly retains Vite 6's
target. Tailwind's Vite plugin declares support for Vite 8. TypeScript 6 requires
explicit Node ambient types for colocated tests and replaces `baseUrl` with
relative `paths` entries.

[xterm 6 release notes](https://github.com/xtermjs/xterm.js/releases/tag/6.0.0)
describe scrollbar changes, the overview-ruler option change and removal of the
implicit Alt-arrow mapping. Shellnest has no custom viewport CSS or overview-ruler
setting, and already handles word navigation in `terminalKeyAction`. All four
addons ship from the same upstream release commit. No clipboard addon is enabled.

[Lucide's v1 migration](https://github.com/lucide-icons/lucide/blob/main/docs/guide/react/migration.md)
removes brand icons; Shellnest imports none of those removed icons.

## Verification and remaining risks

Clean `npm ci`, typecheck, production build, ESLint, formatting, Knip, 191 Node
tests (one skipped), and both SFTP Playwright tests pass on Windows. Local ESLint
excludes ignored `.agents/**` and `artifacts/**`, which are absent in CI.
macOS visual snapshots require macOS and are not regenerated on Windows.

`npm audit --omit=dev` reports zero vulnerabilities. The full audit still reports
19 affected dependency entries (18 high, one moderate), propagated from three
tooling packages: serialize-javascript, extract-zip and basic-ftp. These are not
19 independent vulnerabilities. Their current parents cannot all be upgraded
within the Tauri-compatible WDIO 9 graph; no incompatible overrides or advisory
ignores were added. Revisit with WDIO 10/Tauri service compatibility.

## Rust, crypto and native credential stores

| Family                                  | Before                          | Selected stable version              |
| --------------------------------------- | ------------------------------- | ------------------------------------ |
| Verification compiler                   | Rust 1.98.1                     | Rust 1.99.1                          |
| Tauri / build                           | 2.12.5 / 2.7.4                  | unchanged, latest stable Tauri 2     |
| Tauri updater / process                 | 2.14.1 / 2.4.0                  | unchanged, already current           |
| Argon2                                  | 0.5.3                           | 0.6.0                                |
| XChaCha20Poly1305                       | 0.10.1                          | 0.11.0                               |
| rand                                    | 0.8.8 plus a 0.10 test alias    | 0.10.3, one dependency               |
| Reqwest                                 | 0.12.28 plus transitive 0.13.5  | 0.13.5                               |
| Keyring                                 | 3.6.3                           | keyring-core 1.0.1 and native stores |
| Native Windows / Apple / D-Bus stores   | bundled in Keyring 3            | 1.1.0 / 1.0.2 / 1.0.1                |
| russh / russh-sftp / portable-pty / nix | 0.65.0 / 3.0.1 / 0.9.0 / 0.31.3 | unchanged, already current           |

Tauri 3 is an alpha and is excluded. CI already installs stable Rust; the crate's
declared minimum remains 1.90. Other direct Rust requirements were checked against
the registry and the lockfile was refreshed within compatible stable requirements.

The vault reader/writer remains `vault/mod.rs`: envelope version 1, 16-byte salt,
24-byte nonce, Argon2id v19 defaults and `server-manager:vault:1` AAD are unchanged.
The fixture in `vault/fixtures/v1.json` was generated with Argon2 0.5.3 and
XChaCha20Poly1305 0.10.1. Its test both opens the old ciphertext and reproduces it
with the new libraries, checking compatibility in both directions. Existing
encrypted sync, conflict, schema migration and secret-free snapshot tests remain.
Explicit crypto `zeroize` features retain cipher-key wiping and enable Argon2
working-memory wiping. OS entropy uses fallible `SysRng` and returns the existing
I/O error instead of panicking. No vault migration or new format is needed.

[Reqwest 0.13 notes](https://github.com/seanmonstar/reqwest/releases/tag/v0.13.0)
rename `rustls-tls` to `rustls` and use the platform certificate verifier and
AWS-LC provider. HTTPS enforcement, redirect refusal and timeouts remain in the
sync client; existing encrypted two-device sync tests pass.

[Keyring 4's own guidance](https://docs.rs/keyring/4.2.0/keyring/)
recommends core plus selected native stores for applications that choose their
backends. Its all-in-one default switches Linux to zbus 5 and introduces three
unmaintained-crate advisories. Shellnest instead keeps the synchronous D-Bus
backend, with Rust session encryption, and selects native Apple/Windows stores.
The service stays `Shellnest`, the username stays the vault ID and the saved
value stays a zeroized Base64-encoded key. Windows keeps `{user}.{service}` targets
and UTF-16 passwords; Apple keeps service/account attributes; Secret Service keeps
service/username matching, including older records with a target attribute.
Store initialization is synchronized and happens once, as in upstream Keyring 4.

Reverting the Rust commit and restoring its lockfile restores the prior libraries.
Mixed versions use the same vault, sync and credential representations. A real
Windows check read a Keyring 3 credential with the new store, wrote it back and
read it with Keyring 3; the synthetic credential was deleted afterwards. The native
round-trip test is opt-in because CI may lack an unlocked credential store.

The current updater already uses ZIP 9.1.3, so the three stale ZIP 4 advisory
exceptions were removed. `cargo deny check` passes without new exceptions.
This does **not** clear Linux's `RUSTSEC-2024-0429`: stable Tauri 2 still pulls
`glib 0.18.5` through GTK 3, tao, muda and webkit2gtk. The fixed `glib >=0.20`
cannot replace that crate across its API boundary. No compatible stable GTK/Tauri
upgrade removes this branch. Cargo-deny's default transitive-unsound scope does
not flag it; reachability and exploitability in Shellnest remain unproven.
