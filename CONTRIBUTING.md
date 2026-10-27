# Contributing

Thanks for helping. Shellnest is a small project: keep changes focused and easy to review.

## Setup

Node.js 22.15+, Rust and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run desktop   # app with hot reload
npm run dev       # UI only in a browser, with demo data (no SSH, no encryption)
```

## Before you open a pull request

```sh
npx tsc --noEmit
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

- One topic per pull request. Open an issue first for anything large.
- Add a test for new logic. Rust tests live next to the code; JS tests are `src/**/*.test.mjs` and `sync/*.test.mjs`.
- Match the surrounding code style. There is no formatter config to fight with.
- The interface is in Italian. Keep new UI strings in Italian for now; a translation layer is a welcome contribution.
- Visual tests (`npm run test:visual`) compare screenshots made on macOS and are not run in CI. Update snapshots only if you changed the UI on purpose.

## Security-sensitive changes

Anything touching the vault, key handling or sync needs extra care. Never change the encryption `AAD` constant in `src-tauri/src/vault/mod.rs`: existing vaults would stop opening. Report vulnerabilities privately, see [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your work is released under the [MIT license](LICENSE).
