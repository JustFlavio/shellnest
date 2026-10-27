# Shellnest Sync server

A small self-hosted server that keeps the **encrypted** Shellnest vault in step between your devices. Plain Node.js (22.18+ or 24), no dependencies, no build step: the TypeScript sources run directly through Node's built-in type stripping.

It is a personal service: **one token, no accounts, no multi-user support.** Anyone holding the token can read, replace and overwrite every vault stored on this server (never decrypt them).

## What the server can and cannot see

| Can see                                                | Cannot see                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Vault ids in the URL (`/vaults/work`)                  | Hosts, users, passwords, SSH keys, folders                                |
| Size and timing of each upload, client IP addresses    | Your master password                                                      |
| The sync token you configured (as the client sends it) | The decrypted content: the vault is encrypted on the device before upload |

The server stores exactly the container the app produces (`version`, `salt`, `nonce`, `ciphertext`) and refuses anything else. It never logs tokens or vault contents. Security still rests on a strong master password: whoever steals a stored file can try to guess it offline.

## Configuration

All settings are environment variables.

| Variable        | Default                         | Meaning                                                                                    |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `SYNC_TOKEN`    | none, **required**              | Shared secret, at least 32 characters. The server refuses to start without it.             |
| `SYNC_HOST`     | `127.0.0.1`                     | Address to listen on. Loopback only unless you change it. The Docker image sets `0.0.0.0`. |
| `SYNC_PORT`     | `8787`                          | TCP port.                                                                                  |
| `SYNC_DATA_DIR` | `sync/data` (`/data` in Docker) | Where the encrypted containers are stored.                                                 |

Generate a token and keep it in your password manager or the secret store of your deployment. Do not commit it or pass it on a command line that ends up in shell history.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Run with Docker

```sh
docker build -t shellnest-sync sync
docker volume create shellnest-sync-data
docker run -d --name shellnest-sync --restart unless-stopped \
  -e SYNC_TOKEN="$(cat /path/to/token-file)" \
  -v shellnest-sync-data:/data \
  -p 127.0.0.1:8787:8787 \
  shellnest-sync
```

- The container runs as the unprivileged `node` user. With a named volume the permissions are right already; with a bind mount, make the folder writable by uid 1000 (`chown 1000:1000 /srv/shellnest-sync`).
- Publishing the port on `127.0.0.1` keeps it private; the reverse proxy below is the public entry point.
- The image has a healthcheck on `/health`; `docker ps` shows `healthy`.
- `docker stop` triggers a clean shutdown: running requests finish, then the process exits.

## Run with plain Node

From the repository root, or copy the `sync/` folder (`server.ts` and `src/`) anywhere:

```sh
export SYNC_TOKEN="$(cat /path/to/token-file)"
npm run sync              # or: node sync/server.ts
```

To keep it running on a VPS, use a service manager. Example systemd unit (`/etc/systemd/system/shellnest-sync.service`):

```ini
[Unit]
Description=Shellnest Sync
After=network.target

[Service]
User=shellnest
# Contains SYNC_TOKEN=..., chmod 600
EnvironmentFile=/etc/shellnest-sync.env
Environment=SYNC_DATA_DIR=/var/lib/shellnest-sync
ExecStart=/usr/bin/node /opt/shellnest-sync/server.ts
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/shellnest-sync

[Install]
WantedBy=multi-user.target
```

## HTTPS with a reverse proxy

The desktop app accepts plain HTTP only for `localhost`. For a remote server you must serve HTTPS, and the app does not follow redirects, so use the final URL. Keep the Shellnest server on loopback and let a proxy terminate TLS.

Caddy (certificates are automatic):

```
sync.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

nginx (certificate from certbot or similar):

```nginx
server {
    listen 443 ssl;
    server_name sync.example.com;
    ssl_certificate     /etc/letsencrypt/live/sync.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sync.example.com/privkey.pem;

    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
    }
}
```

Do not enable access logging of request headers on the proxy: they carry the token. Then check it from outside:

```sh
curl https://sync.example.com/health        # {"ok":true}
```

## Using it from the app

In the vault's sync settings enter the server URL and the token.

- Personal vault: `https://sync.example.com`
- Any other vault: the full URL `https://sync.example.com/vaults/<id>`. Use the same URL on every device (the id is lowercase letters, digits and `-`, up to 64 characters).

On a second device choose **Collega questo dispositivo** and enter the same URL, token and master password.

## Storage layout and backups

```
<data dir>/vault.json                  personal vault (also served at /vault and /vaults/personal)
<data dir>/vaults/<id>.json            every other vault
<data dir>/vaults/<id>.previous.json   the version before the last write
```

Every write goes to a temporary file that is then renamed, so a crash leaves the old or the new file, never a half-written one. Files are mode `0600`, folders `0700`.

Back up the whole data directory; the files are already encrypted, so a plain copy is safe to store off-site:

```sh
docker run --rm -v shellnest-sync-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/shellnest-sync-$(date +%F).tar.gz -C /data .
```

Restoring is the reverse: stop the server, extract into the data directory, start it. Devices keep their own local copy of each vault, which is the other half of your backup.

## HTTP API

| Request                                    | Result                                                |
| ------------------------------------------ | ----------------------------------------------------- |
| `GET /health`                              | `200 {"ok":true}`, no token needed                    |
| `GET /vaults/<id>` (or `/vault`)           | `200` with the container and an `ETag`, `404` if none |
| `PUT /vaults/<id>` with `If-None-Match: *` | create; `200`, or `412` if it exists                  |
| `PUT /vaults/<id>` with `If-Match: <etag>` | replace; `200` with the new `ETag`, or `412` if stale |

All vault routes need `Authorization: Bearer <token>` (`401` otherwise). Other status codes: `400` body is not an encrypted container, `404` unknown route or invalid id, `405` method other than GET/PUT, `413` body over 8 MiB, `500` storage failure.

## Limits

- One token for every vault on the server; no users, no per-vault permissions.
- The server keeps one previous version only. It is not a history.
- No rate limiting; use a strong token and the proxy if you need more.
- A request body is capped at 8 MiB and must arrive within 30 seconds.
- Conflicts are never merged: the app keeps your local copy and asks you to resolve it (see the guide).

## Development

```sh
node --test "sync/*.test.ts"
```

Layout: `server.ts` (entry, re-exports `createSyncServer`), `src/app.ts` (HTTP routing), `src/storage.ts` (files, ETags, serialized writes), `src/auth.ts`, `src/vault-id.ts`, `src/envelope.ts`, `src/body.ts`, `src/config.ts`, `src/main.ts` (startup and shutdown).
