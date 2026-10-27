# Releases and updates

## Making a release

1. Set the new version in `package.json` and `src-tauri/Cargo.toml`, move the `CHANGELOG.md` entry from "Unreleased" to the version, and commit.
2. Tag the commit `vX.Y.Z` (it must equal the `package.json` version, the workflow checks) and push the tag.
3. `.github/workflows/release.yml` creates **one draft pre-release**, then builds macOS arm64, macOS x64 and Windows in parallel and uploads the installers, their `.sig` signatures and a `latest.json` into it. The first job stops while the updater key is still a placeholder (see below).
4. Open the draft, try an installer, and **publish** it. Publishing is the go-live moment.
5. Publishing triggers `.github/workflows/updater-manifest.yml`, which copies that release's `latest.json` to the permanent `updater` release. Installed apps read it from there.

Installers are not code-signed (no Apple or Windows certificate). That is separate from the update signature below.

## How the app finds updates

The app asks `https://github.com/JustFlavio/shellnest/releases/download/updater/latest.json` (`plugins.updater.endpoints` in `src-tauri/tauri.conf.json`).

GitHub's own `releases/latest/download/…` only resolves to the newest release that is neither a draft nor a pre-release. Shellnest 0.x releases are pre-releases, so that URL would never find them. The `updater` release has a fixed tag, is created once by the manifest workflow, is not marked "Latest" and never changes meaning: only its `latest.json` asset is replaced.

The workflow refuses to replace the manifest with an older or equal version, and fails if the manifest misses a platform (`darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`). The three build jobs each merge their platform into the release's `latest.json`; if one of them raced and a platform is missing, re-run that build job and then re-run the manifest workflow.

Until the repository is public, the endpoint returns 404 for everyone, so the real path cannot be tested. A pre-release check from the app then reads "Controllo non riuscito: nessun elenco di aggiornamenti trovato sul server".

The check contacts only GitHub and sends nothing from the vault.

## The updater signing key

Every update package is signed with a Tauri updater key (minisign). The app only installs packages that verify against the **public** key built into it. This is unrelated to macOS/Windows code signing.

The `pubkey` in `src-tauri/tauri.conf.json` is a placeholder (a well-formed but fake key whose comment reads `PLACEHOLDER`) until the owner generates the real key. With the placeholder the release workflow stops at its first job, and an app built from it reports the error in the update toast instead of crashing.

### One-time setup

1. Generate the key pair on your machine, never in the repository:

   ```sh
   npx tauri signer generate -w ~/.tauri/shellnest.key
   ```

   Choose a password. The command writes `~/.tauri/shellnest.key` (private) and `~/.tauri/shellnest.key.pub` (public).

2. Put the **content of `shellnest.key.pub`** into `plugins.updater.pubkey` in `src-tauri/tauri.conf.json` and commit it. A public key is not a secret.
3. In the GitHub repository, Settings, Secrets and variables, Actions, add two repository secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`: the **content** of `~/.tauri/shellnest.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password from step 1
4. Keep a backup of the private key and its password in a password manager.

`.gitignore` already excludes `*.key`; never commit the private key.

### Building locally

With `createUpdaterArtifacts` on, `tauri build` signs the update package and fails when the private key is missing. Provide it for the build:

```sh
TAURI_SIGNING_PRIVATE_KEY=~/.tauri/shellnest.key TAURI_SIGNING_PRIVATE_KEY_PASSWORD=... npm run desktop:build
```

Or skip the update artifacts for a plain local installer:

```sh
npm run desktop:build -- --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

The desktop e2e build already turns them off (`src-tauri/tauri.e2e.conf.json`).

### Lost key

Releases can no longer be signed with the old key, and installed apps trust only that key. Generate a new pair, change `pubkey`, and publish a release: **already installed apps cannot update to it** and users must install it by hand once. Back the key up to avoid this.

### Leaked key

Whoever holds the private key and can write to the `updater` release or the release assets could serve a malicious update. Treat it like a lost key: delete the GitHub secrets, generate a new pair, change `pubkey`, publish a release users install by hand, and tell them. Rotating cannot be done through the update channel itself, because the old, compromised key is what installed apps still trust.

## Trying an update locally

Needs a throwaway key (never the real one) and two versions of the app.

1. Generate a throwaway key: `npx tauri signer generate -w /tmp/throwaway.key --password ""`.
2. Build version A with its public key and a local endpoint, without touching the repository files:

   ```sh
   export TAURI_SIGNING_PRIVATE_KEY=/tmp/throwaway.key TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
   npx tauri build --bundles app --config '{"plugins":{"updater":{"endpoints":["http://127.0.0.1:8787/latest.json"],"dangerousInsecureTransportProtocol":true,"pubkey":"<content of /tmp/throwaway.key.pub>"}}}'
   ```

   Install or keep the resulting `.app` (macOS: `src-tauri/target/release/bundle/macos/`).

3. Bump the version in `package.json` and `src-tauri/Cargo.toml`, run the same build again and keep `Shellnest.app.tar.gz` and `Shellnest.app.tar.gz.sig` from `bundle/macos/`. Put them in a folder with this `latest.json` (the `signature` is the content of the `.sig` file):

   ```json
   {
     "version": "0.1.1",
     "pub_date": "2026-01-01T00:00:00Z",
     "platforms": {
       "darwin-aarch64": {
         "signature": "<content of Shellnest.app.tar.gz.sig>",
         "url": "http://127.0.0.1:8787/Shellnest.app.tar.gz"
       }
     }
   }
   ```

   (`darwin-x86_64` on an Intel Mac.) Serve the folder: `npx http-server -p 8787` or `python3 -m http.server 8787`. The updater refuses plain `http://` endpoints unless `dangerousInsecureTransportProtocol` is set, which is why step 2 sets it; it only ever goes in that command line, never in the committed config.

4. Start version A, wait 5 seconds or use menu, Controlla aggiornamenti.

Revert the version bump afterwards.
