# Shellnest

Desktop SSH client (Tauri 2, React 19, Rust). Encrypted local vaults, optional self-hosted sync. Windows and macOS. Alpha. The UI is in Italian.

## Commands

```sh
npm ci
npm run desktop        # app with hot reload
npm run dev            # UI only in a browser, demo backend (src/lib/preview.ts)
npx tsc --noEmit
npm test               # node:test, src/**/*.test.{ts,mjs} and sync/*.test.mjs (Node 22.18+ strips types)
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run test:visual    # Playwright screenshots on the browser preview, macOS only, not in CI
npm run test:desktop   # WebDriver tests on the real app (e2e/)
```

## Layout

- `src/main.tsx`: entry point only. `src/app/` is the shell (header, layout, `useAppState` and the `useApp()` context that components read).
- `src/features/`: `hosts` (vault browser, editors, groups), `terminal` (tabs, panes, launcher, workbench state), `vault` (unlock, sync, vault switching), `settings` (settings dialog, shortcuts). Import across features with the `@/` alias.
- `src/components/` shared widgets, `src/components/ui` shadcn/Base UI primitives, `src/lib/` helpers (types, platform, preview backend).
- Pure logic with no React or Tauri imports (settings, shortcuts, groups, connection parsing, workbench state) lives in plain `.ts` files with a `.test.ts` beside them. Node runs the tests directly by stripping types: relative imports with the `.ts` extension (no `@/` alias), `import type` for types, no enums. Put testable logic here, next to its feature.
- `src/lib/preview.ts`: in-memory backend used when the UI runs in a browser. It does no encryption or SSH. Keep its commands in step with the Tauri ones.
- `src-tauri/src/`: `main.rs` (Tauri commands, app state, keychain), `vault.rs` (encryption, files), `model.rs` (data model, migrations), `terminal.rs` (SSH via russh, PTY), `local.rs` (local shell), `sync.rs` (sync client).
- `sync/`: standalone Node.js sync server, no dependencies.
- `docs/`: `guida.it.md` is the detailed guide; `settings.md` lists the settings.

## Rules that are easy to break

- Never change the `AAD` constant in `src-tauri/src/vault.rs`, or the vault file format, without a migration. Existing vaults would stop opening.
- Secrets never go to `localStorage`, logs or the host list returned to the UI. `localStorage` holds display preferences only (`shellnest.*` keys).
- Decrypted data and keys are zeroized on the Rust side. Keep it that way for new secret types.
- Window flags live in two files: `tauri.conf.json` and `tauri.macos.conf.json`. The macOS file replaces the `windows` array, so a flag must be set in both.
- The `desktop-e2e` feature is debug-only and uses a temporary data dir (`SHELLNEST_E2E_DATA_DIR`).
- Do not add a feature with a known limit and commit it: implement the limit or ask which cases to exclude.

## Style

- Match the surrounding code. Comments only for the why that the code cannot show.
- Add a test for new logic: Rust tests next to the code, JS tests beside the module (`*.test.ts`).
- Keep UI text in Italian. Code, commits and docs outside `docs/guida.it.md` are in English.
