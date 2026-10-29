# Contributing

Thanks for helping. Shellnest is a small project: keep changes focused and easy to review.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

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
- Every UI text goes through `t()` and lives in `src/locales/en.json` (the source) and the other locale files. See [Translations](#translations).
- Visual tests (`npm run test:visual`) compare screenshots made on macOS and are not run in CI. Update snapshots only if you changed the UI on purpose.

## Translations

The interface uses [i18next](https://www.i18next.com/). `src/locales/en.json` is the source and the fallback; every other language is a JSON file beside it.

- **Add a text:** add the key to `en.json`, then to every other file (`it.json`). Use it with `t("area.component.key")`: keys are typed, so a wrong one does not compile. `npm test` checks that all locales have the same keys and placeholders.
- **Placeholders** are `{{name}}`. For counts use `count` with `_one` and `_other` keys (`item_one`, `item_other`). Markup inside a sentence uses `<b>…</b>` in the connection log and `<Trans>` with `<strong>` elsewhere.
- **Add a language:** copy `en.json` to `src/locales/<code>.json`, translate it, then add the code to `LANGUAGES` and to the `resources` in `src/i18n/i18n.ts`, and its name to the `language` block of every locale file.
- **Rust never writes text for the UI.** Errors and connection messages travel as `{ code, params }` (`src-tauri/src/error.rs`, `src-tauri/src/message.rs`); their texts are the `error.*` and `connection.*` keys. A new error variant needs its key in each locale.
- Keep `docs/guida.it.md` Italian; the rest of the documentation is English.

## Git blame

The repository was formatted in one commit. To keep `git blame` useful, run once:

```sh
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Security-sensitive changes

Anything touching the vault, key handling or sync needs extra care. Never change the encryption `AAD` constant in `src-tauri/src/vault/mod.rs`: existing vaults would stop opening. Report vulnerabilities privately, see [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your work is released under the [MIT license](LICENSE).
