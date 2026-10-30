# Releases and updates

## Making a release

1. Set the new version in `package.json` and `src-tauri/Cargo.toml`, move the `CHANGELOG.md` entry from "Unreleased" to the version, and commit.
2. Tag the commit `vX.Y.Z` (it must equal the `package.json` version, the workflow checks) and push the tag.
3. `.github/workflows/release.yml` creates **one draft release**, then builds macOS arm64, macOS x64, Windows and Linux x86_64 (on `ubuntu-22.04`, for an older glibc) in parallel and uploads the installers, their `.sig` signatures and a `latest.json` into it. The draft body is a fixed sentence followed by the pull requests merged since the last release, which GitHub generates (grouped by label as `.github/release.yml` says: `enhancement`, `bug`, `documentation`, `dependencies`); read and edit it before publishing. `CHANGELOG.md` stays the hand-written summary. The first job stops while the updater key is still a placeholder (see below).
4. Wait for the `validate-release` job: it checks the draft manifest's version, platform coverage, signatures being present, and that every download points to an asset of this release. Open the draft, try an installer and a signed update, and **publish** it. Publishing is the go-live moment.
5. Publishing triggers `.github/workflows/release-assets.yml`: it checks that `latest.json` has every platform and uploads the installers without the version in the name (`Shellnest_aarch64.dmg`, `Shellnest_amd64.deb`, …) and a `SHA256SUMS` to the same release. The README table and `install.sh` link to those through `releases/latest/download/`, so the links never change.

Linux ships a `.deb` and an AppImage. Both are updater artifacts (`linux-x86_64-appimage` and `linux-x86_64-deb` in `latest.json`): the updater plugin replaces an AppImage in place and installs a `.deb` with `pkexec dpkg -i`, which asks for the password in a system prompt. The `.deb` path has not been tried on a real desktop. The `bundle-linux` job in `ci.yml` builds both on every pull request (without updater artifacts) so a broken bundle shows up before a release.

Installers are not code-signed (no Apple or Windows certificate). That is separate from the update signature below.

## How the app finds updates

The app asks `https://github.com/JustFlavio/shellnest/releases/latest/download/latest.json` (`plugins.updater.endpoints` in `src-tauri/tauri.conf.json`). GitHub resolves `releases/latest` to the newest release that is neither a draft nor a pre-release, so releases are published as normal releases, not pre-releases (the alpha state is said in the release text and the README). A pre-release would never be found.

`latest.json` is merged by the four build jobs, one platform each; if one raced and a platform is missing, re-run that build job and then the "Release assets" workflow, which fails when a platform (`darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`, `linux-x86_64`) is missing.

The pinned tauri-action 1.0.0 uploads macOS update archives as
`Shellnest_<version>_<arch>.app.tar.gz` (and `.sig`). These uploaded names differ
from the local CLI's `Shellnest.app.tar.gz`. Both architectures coexist in one
release. Installer names and the version-free installer aliases stay unchanged.
The manifest now uses GitHub API asset URLs rather than browser download URLs.
The updater sends `Accept: application/octet-stream`, which makes those URLs return
the public artifact without a GitHub token. Existing clients can use either URL
shape; the signature check still happens before installation. API URLs identify
one asset, so regenerate the manifest if an artifact is deleted and re-uploaded.
The draft validation job and the post-publication check accept both URL shapes
and reject missing signatures or references to another release's assets.

### Apps up to 0.1.2

Those versions read `releases/download/updater/latest.json` from a permanent release with the tag `updater`. It is no longer maintained. After the first release published the new way, copy its manifest there so the old apps find that release (the artifact URLs inside it identify that release, not future releases):

```sh
gh release download vX.Y.Z --pattern latest.json --dir /tmp/manifest
gh release upload updater /tmp/manifest/latest.json --clobber
```

Repeat that copy for later releases while supporting those old clients. Delete the `updater` release when no installed copy of 0.1.2 or older is left.

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

Whoever holds the private key and can write to the release assets could serve a malicious update. Treat it like a lost key: delete the GitHub secrets, generate a new pair, change `pubkey`, publish a release users install by hand, and tell them. Rotating cannot be done through the update channel itself, because the old, compromised key is what installed apps still trust.

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
