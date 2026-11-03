# Shellnest Sync server

A small self-hosted server for Shellnest accounts and vaults: your vaults on all your devices, and vaults shared with colleagues. Plain Node.js (22.18+ or 24), no dependencies, no build step: the TypeScript sources run directly through Node's built-in type stripping.

Everything a vault contains is encrypted on the devices. The server checks who may read and write what, and stores ciphertext.

## What the server can and cannot see

| Can see                                                       | Cannot see                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| Usernames, device names, who belongs to which vault, roles    | Hosts, addresses, users, passwords, SSH keys, folders, tags |
| Size and time of each change, client addresses (on the proxy) | Vault names (encrypted with the vault key)                  |
| Public keys of the accounts                                   | Your password: devices send a key derived from it, never it |
| Hashes of device tokens and invite codes                      | The account key, private keys and vault keys (all wrapped)  |

A copy of the data directory is neither a login nor readable data: login keys are stored as scrypt hashes, tokens as SHA-256, and the rest is encrypted with keys the server never had. Whoever steals the copy can still try to guess passwords offline, so use long ones.

## Quick start with Docker Compose and HTTPS

`compose.yaml` runs the server behind [Caddy](https://caddyserver.com), which gets and renews the certificate on its own.

1. Point a DNS name (for example `sync.example.com`) at the machine and open ports 80 and 443.
2. From the `sync/` folder:

   ```sh
   SYNC_DOMAIN=sync.example.com docker compose up -d
   docker compose exec sync node server.ts invite --admin
   ```

3. In the app: **Impostazioni → Vault → Ho un invito**, with `https://sync.example.com`, the invite code, a username and a password. Save the recovery key it shows.

Check it from outside with `curl https://sync.example.com/health` (`{"ok":true}`).

- The server listens only on the compose network; Caddy is the public entry point.
- Caddy logs one JSON line per request to stdout (`docker compose logs caddy`). It redacts the `Authorization` header; request bodies are never logged.
- Keep `SYNC_DOMAIN` in a `.env` file beside `compose.yaml` instead of typing it each time.

## Accounts and invites

There is no open sign-up. Every account starts from a one-time invite, valid 7 days.

- The first account needs an admin invite from the command line: `node server.ts invite --admin` (in Docker: `docker compose exec sync node server.ts invite --admin`). It works while the server is running.
- Admins create invites from the app (**Impostazioni → Vault → Invita**).
- At sign-up the app shows a **recovery key**, once. With it you set a new password if you forget yours, and every other device is signed out. Without the password and the recovery key the account cannot be opened, not even by the admin.
- Changing the password keeps your devices signed in. An unlocked device takes the new password at its next sync; a device that was off opens with the new password as soon as it reaches the server.
- **Dispositivi** lists the devices signed in to the account; removing one signs it out at its next request. An account keeps at most 20 devices: a new sign-in drops the oldest.
- Failed sign-ins are limited per username and client address together (10 in 15 minutes) and per client address (200 in 15 minutes, across all usernames). Past a limit, sign-ins from there are refused for the rest of the window. Someone guessing your password from elsewhere blocks only themselves; an office behind one VPN stays well under the address limit. Devices already signed in are never affected.
- A wrong password and an unknown username get the same reply in the same time, so sign-ins do not reveal which accounts exist.

## Vaults, roles and sharing

A vault uploaded from the app has two parts:

- the **team** part, which every member sees: hosts, folders, host fingerprints, and the identities and keys someone chose to share;
- each member's **private** part, synced only between that member's devices: their own identities and keys, which credentials they use for which host, workspaces and connection history.

| Role           | Can                                                       |
| -------------- | --------------------------------------------------------- |
| Proprietario   | everything, including members, roles and the vault's name |
| Può modificare | change the team part                                      |
| Sola lettura   | see the team part and connect with their own credentials  |

Removing a member replaces the vault key in one write: the new key is sealed to everyone left, and the app lists the shared identities and keys the removed member could read, to change on the servers too.

Concurrent changes merge field by field. A field changed on two devices keeps the last one written; the server keeps the last 20 versions of each vault's team part for manual recovery.

## Configuration

All settings are environment variables. The Docker image sets the host and data directory already.

| Variable           | Default                         | Meaning                                                                                                     |
| ------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `SYNC_HOST`        | `127.0.0.1`                     | Address to listen on. Loopback only unless you change it.                                                   |
| `SYNC_PORT`        | `8787`                          | TCP port.                                                                                                   |
| `SYNC_DATA_DIR`    | `sync/data` (`/data` in Docker) | Where accounts and encrypted vaults are stored.                                                             |
| `SYNC_TRUST_PROXY` | unset                           | `1` behind a reverse proxy: the client address is the last `X-Forwarded-For` entry. `compose.yaml` sets it. |

## Run without Compose

The app accepts plain HTTP only for `localhost`, and it does not follow redirects: a remote server needs HTTPS at the address you type in the app.

With Docker and your own proxy:

```sh
docker build -t shellnest-sync sync
docker run -d --name shellnest-sync --restart unless-stopped \
  -v shellnest-sync-data:/data -p 127.0.0.1:8787:8787 shellnest-sync
docker exec shellnest-sync node server.ts invite --admin
```

With plain Node, from the repository root or a copy of the `sync/` folder (`server.ts` and `src/`):

```sh
npm run sync                       # or: node sync/server.ts
node sync/server.ts invite --admin
```

Example systemd unit (`/etc/systemd/system/shellnest-sync.service`):

```ini
[Unit]
Description=Shellnest Sync
After=network.target

[Service]
User=shellnest
Environment=SYNC_DATA_DIR=/var/lib/shellnest-sync
ExecStart=/usr/bin/node /opt/shellnest-sync/server.ts
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/shellnest-sync

[Install]
WantedBy=multi-user.target
```

The proxy terminates TLS and forwards to `127.0.0.1:8787`. Allow request bodies up to 8 MiB, and do not log request headers or bodies.

- The container runs as the unprivileged `node` user. With a bind mount instead of a named volume, make the folder writable by uid 1000.
- The image has a healthcheck on `/health`.
- `docker stop` shuts down cleanly: running requests and their writes finish first.

## Storage layout and backups

```
<data dir>/secret                         random bytes for the replies about unknown usernames
<data dir>/users/<id>.json                accounts, wrapped keys, devices (token hashes)
<data dir>/invites/<hash>.json            pending invites
<data dir>/vaults/<id>.json               members, roles, sealed vault keys, revision
<data dir>/data/<id>.json                 a vault's team part, encrypted
<data dir>/history/<id>/<revision>.json   the last 20 previous team parts
<data dir>/private/<id>/<user>.json       a member's private part, encrypted
```

Every write goes to a temporary file that is flushed and then renamed, so a crash leaves the old or the new file. Files are mode `0600`, folders `0700`. Writes go through one queue, so a check and its write are atomic with respect to other requests.

Back up the whole data directory; a plain copy is safe to store off-site. With Compose:

```sh
docker compose stop sync
docker run --rm -v shellnest-sync_sync-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/shellnest-sync-$(date +%F).tar.gz -C /data .
docker compose start sync
```

The volume name is `<project>_sync-data`; `docker volume ls` shows it. Restoring is the reverse. Each device also keeps an encrypted copy of its vaults.

## HTTP API

All routes are under `/api`, except `GET /health`. Bodies are JSON. Routes marked _public_ need no session; the others need `Authorization: Bearer <device token>`.

| Request                                           | Purpose                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `POST /prelogin` _public_                         | the Argon2 salt of a username (a stable decoy if unknown)      |
| `POST /login` _public_                            | new device session and the wrapped account keys                |
| `POST /login/keys` _public_                       | the wrapped account keys, no session (after a password change) |
| `POST /register` _public_                         | create an account with an invite                               |
| `POST /recover/start`, `/recover/finish` _public_ | recovery key: new password, every device signed out            |
| `GET /account`, `POST /account/password`          | the account; change the password                               |
| `POST /logout`                                    | end this device's session                                      |
| `GET /devices`, `DELETE /devices/<id>`            | list and revoke devices                                        |
| `POST /invites`                                   | create an invite (admins)                                      |
| `GET /users/<username>`                           | a user's id and public key, to add them to a vault             |
| `GET /vaults`, `POST /vaults`                     | vaults of the account; upload a vault                          |
| `GET /vaults/<id>`, `DELETE /vaults/<id>`         | read (with the team part) or delete (owners)                   |
| `PUT /vaults/<id>/data`, `/meta`                  | new team part (owners, editors) or name (owners)               |
| `GET/PUT /vaults/<id>/private`                    | this member's private part                                     |
| `GET /vaults/<id>/members`                        | members and roles                                              |
| `PUT /vaults/<id>/members/<user id>`              | add a member or change a role (owners)                         |
| `DELETE /vaults/<id>/members/me`                  | leave the vault                                                |
| `POST /vaults/<id>/rotate`                        | remove members and replace the vault key (owners)              |

Writes carry the revision and key epoch they started from; a stale one gets `409` and the app pulls, merges and tries again. Other codes: `400` malformed body, `401` no valid session or wrong login, `403` role not allowed or invalid invite, `404` unknown route or not a member, `413` body over the limit (8 MiB for vault contents, 64 KiB otherwise), `429` too many failed sign-ins, `500` storage failure.

## Limits

- There is no limit per username alone, on purpose: it would let anyone who knows a username keep its owner from signing in. Guessing one password from many addresses at once is slowed only by the 12-character minimum and the Argon2id cost of each guess on the attacker's side.
- Set `SYNC_TRUST_PROXY=1` only when the server is reachable through the proxy alone. Exposed directly, a client could send its own `X-Forwarded-For` and pick a new address for each attempt. Without the variable the address is the TCP peer, which behind a proxy is the proxy itself: then the per-address limit counts every client together.
- Accounts and vault records are kept in memory and in JSON files: meant for a person or a small team, not thousands of users.
- One server process; no clustering.
- Polling every 30 seconds per open vault, no push.

## Development

```sh
node --test "sync/*.test.ts"
```

Layout: `server.ts` (entry), `src/main.ts` (configuration, the `invite` command, startup and shutdown), `src/app.ts` (routes, roles), `src/auth.ts` (verifiers, tokens, limiter), `src/store.ts` (files and the write queue), `src/shapes.ts` (input checks), `src/http.ts` (bodies and replies), `src/invite.ts`, `src/config.ts`.

The desktop app has an end-to-end test against this server in `src-tauri/src/sync/tests.rs` (`cargo test`), and `npm run test:desktop` drives the real app against it.
