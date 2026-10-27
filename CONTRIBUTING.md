# Contributing

Thanks for helping. Shellnest is a small project: keep changes focused and easy to review.

## Setup

Node.js 22.18+, Rust and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run desktop   # app with hot reload
npm run dev       # UI only in a browser, with demo data (no SSH, no encryption)
```

## Before you open a pull request

```sh
npm run typecheck
npm run lint            # npm run lint:fix fixes what it can
npm run format          # Prettier; format:check is what CI runs
npm run knip            # unused files, exports and dependencies
npm test
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo deny --manifest-path src-tauri/Cargo.toml check   # only when you change dependencies
```

Optional: `npx react-doctor@latest .` reports React issues (missing effect dependencies, accessibility) that go beyond the lint rules.

- One topic per pull request. Open an issue first for anything large.
- Add a test for new logic. Rust tests live next to the code; JS tests are `src/**/*.test.ts` and `sync/*.test.ts`.
- Match the surrounding code style. Prettier (defaults) and ESLint enforce it; run them before you push.
- `src/components/ui` holds shadcn primitives with exports that are not all used; knip ignores that folder.
- The interface is in Italian. Keep new UI strings in Italian for now; a translation layer is a welcome contribution.
- Visual tests (`npm run test:visual`) compare screenshots made on macOS and are not run in CI. Update snapshots only if you changed the UI on purpose.

## Git blame

The repository was formatted in one commit. To keep `git blame` useful, run once:

```sh
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Security-sensitive changes

Anything touching the vault, key handling or sync needs extra care. Never change the encryption `AAD` constant in `src-tauri/src/vault/mod.rs`: existing vaults would stop opening. Report vulnerabilities privately, see [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your work is released under the [MIT license](LICENSE).
