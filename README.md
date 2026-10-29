# Shellnest

A desktop SSH client for people who manage their own servers. Hosts, folders, reusable identities and SSH keys live in an encrypted local vault. No account is needed. Optional self-hosted sync keeps several devices in step.

Built with Tauri 2, React and Rust. Windows, macOS and Linux (Ubuntu 22.04+, x86_64).

> **Alpha.** Shellnest is under active development and has not had a security audit. Local use is the tested path. **Sync between devices is experimental.** Back up your vault before trusting it with anything important. The interface is available in English and Italian; more translations are welcome (see [CONTRIBUTING](CONTRIBUTING.md#translations)).

## Screenshots

The screenshots come from the browser demo (`npm run dev`) with sample data.

![Hosts and folders](docs/images/hosts.png)

![Quick launcher](docs/images/launcher.png)

![Connection timeline with the host key check](docs/images/connection.png)

## Features

- Encrypted local vault (Argon2id + XChaCha20-Poly1305), several independent vaults, optional unlock key in the system keychain (Linux: a Secret Service such as GNOME Keyring or KWallet).
- Hosts, nested folders, search, multi-select, quick connect (`Ctrl/Cmd K`).
- Reusable identities and an SSH key store; one identity can serve many hosts.
- Tabbed terminals with split panels, reconnect, duplicate and reorder; local terminal with a native PTY.
- Host key fingerprint check before authenticating, and a hard stop if it changes.
- Terminal themes, fonts and rebindable keyboard shortcuts.
- Optional sync of the encrypted vault through the small Node.js server in [`sync/`](sync) ([deployment guide](sync/README.md)).

Not implemented yet: SFTP, port forwarding, jump hosts, agent forwarding, keyboard-interactive/2FA. See the [roadmap](ROADMAP.md).

## Install

| System                 | Download                                                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS, Apple Silicon   | [Shellnest_aarch64.dmg](https://github.com/JustFlavio/shellnest/releases/latest/download/Shellnest_aarch64.dmg)                                                                                                       |
| macOS, Intel           | [Shellnest_x64.dmg](https://github.com/JustFlavio/shellnest/releases/latest/download/Shellnest_x64.dmg)                                                                                                               |
| Windows 10/11 (64 bit) | [Shellnest_x64-setup.exe](https://github.com/JustFlavio/shellnest/releases/latest/download/Shellnest_x64-setup.exe) or [.msi](https://github.com/JustFlavio/shellnest/releases/latest/download/Shellnest_x64.msi)     |
| Linux (Ubuntu, x86_64) | [Shellnest_amd64.AppImage](https://github.com/JustFlavio/shellnest/releases/latest/download/Shellnest_amd64.AppImage) or [.deb](https://github.com/JustFlavio/shellnest/releases/latest/download/Shellnest_amd64.deb) |

These links always give the newest version. Older ones and the release notes are on the [releases page](https://github.com/JustFlavio/shellnest/releases). The builds are not code-signed (see [First launch](#first-launch)).

On Linux one command installs the AppImage for your user and adds Shellnest to the application menu (it keeps updating itself):

```sh
curl -fsSL https://raw.githubusercontent.com/JustFlavio/shellnest/main/install.sh | sh
```

Or build from source. You need Node.js 22.18+, Rust, and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) (Xcode Command Line Tools on macOS; Visual Studio C++ Build Tools and WebView2 on Windows; on Ubuntu `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libdbus-1-dev libxdo-dev pkg-config patchelf`).

```sh
git clone https://github.com/JustFlavio/shellnest.git
cd shellnest
npm ci
npm run desktop        # run in development
npm run desktop:build  # produce an installer
```

### First launch

The builds are not signed or notarized, so the system warns on first launch.

- **macOS:** after dragging `Shellnest.app` to Applications, remove the download quarantine, then open it. Without this, macOS says the app "is damaged and can't be opened".

  ```sh
  xattr -dr com.apple.quarantine /Applications/Shellnest.app
  ```

- **Windows:** in the SmartScreen window choose "More info", then "Run anyway".

- **Linux:** the easiest way is the install command above. By hand, the AppImage needs `chmod +x` before it runs and does not appear in the menu or dock; the `.deb` installs with `sudo apt install ./file.deb`. Both update from inside the app; a `.deb` update asks for your password in a system prompt (`pkexec dpkg -i`).

## Updates

Shellnest checks GitHub for a newer release a few seconds after launch (turn it off in Settings, Aggiornamenti) and when you choose "Controlla aggiornamenti"; the request contains nothing from your vault. Updates are signed, are downloaded only when you click, and the app restarts only when you click again. How releases work: [docs/releases.md](docs/releases.md).

## Tests

```sh
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Documentation

- [Detailed guide (Italian)](docs/guida.it.md): vaults, sync server setup, limits.
- [Settings](docs/settings.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
