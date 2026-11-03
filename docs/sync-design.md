# Sync: accounts and shared vaults (design)

Status: implemented. Deployment and the HTTP API are in [`sync/README.md`](../sync/README.md); this document explains how the pieces fit and why.

## Goals

A sync that a person or a small team can self-host, where:

1. a new device of the same person needs only **server address, username and password**;
2. hosts can be shared with colleagues, while each person keeps their own credentials unless they choose to share them;
3. two devices editing the same vault merge their changes instead of stopping with a conflict;
4. the server never sees decrypted data.

## Accounts and keys

All randomness comes from the OS RNG, all symmetric encryption is XChaCha20-Poly1305 (`account/crypto.rs`).

```
password ──Argon2id(salt)──► 64 bytes ─┬─► auth key  (sent to the server at login)
                                       └─► wrap key  (never leaves the device)

account key (random)    wrapped by the wrap key, and by the recovery key
X25519 key pair         private half wrapped by the account key, public half on the server
vault key (random)      one per vault, sealed to each member's public key
private-part key        derived from the account key, per vault
device token            random, kept wrapped by the account key in account.json
```

- **Login**: the app asks for the account's salt (`/prelogin`), derives both halves and sends the auth key. The server keeps a scrypt hash of it and compares in constant time. For an unknown username it returns a salt derived from a server secret, so the reply does not reveal which accounts exist.
- **`account.json`** (beside the vaults) keeps the server, the user, the wrapped account key, the wrapped private key and the wrapped device token. It opens with the password, or with the account key from the OS keychain when "Ricorda su questo dispositivo" is on.
- **Password change** re-wraps the account key with a new salt; no vault is re-encrypted and no device is signed out. Other devices pick up the new wrapping: an unlocked one at its next sync (`GET /account`), a locked one when the new password fails locally and the server's salt differs (`POST /login/keys`, which returns the keys without opening a session).
- **Recovery key**: 32 random bytes shown once at sign-up as 8 groups. It wraps the account key too. Recovering sets a new password and signs every device out, since whoever knew the old password may hold a session. Without password and recovery key the account is lost: the admin cannot reset it and keep the data.
- **Sealing a vault key**: ephemeral X25519, HKDF-SHA256, XChaCha20-Poly1305, with the vault and the member in the context.
- Keys are `Zeroizing` on the Rust side.

### Trusting a colleague's public key

The server hands out public keys, so a compromised server could hand out its own. Each account shows a **safety code** (a short hash of its public key) to compare out of band before sharing. The app pins a member's key the first time it uses it (`AccountFile::pins`) and refuses a different one later.

## Vaults on the server

A local vault stays local until the owner uploads it. Uploading splits it in two parts (`model/shared.rs`):

| Part    | Who reads it                     | Holds                                                                                       |
| ------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| Team    | every member                     | hosts, folders, fingerprints, and the identities and keys someone shared                    |
| Private | one member, on all their devices | their identities and keys, which credentials they use where, workspaces, connection history |

The commands keep working on one `Data`, the effective view of both parts. After an edit, `split` compares the view before and after and sends each change to its part. A host's credentials come from the team (a shared identity chosen by an editor) or from the member's own binding for that host or its folder.

A copy of the local file is kept as `.pre-server.bak` when a vault is uploaded.

### Merging

Each sync pulls both parts, merges, and pushes (`sync/mod.rs`, `model/merge.rs`). The merge is three-way, against the version both sides started from:

- records match by id and merge field by field;
- a field changed on one side takes that change; changed on both, the local value wins, since this device writes last;
- an edit beats a deletion, and a record still referred to comes back;
- a result that breaks a rule (two folders with one name, a loop) is refused and the local copy is kept.

Writes carry the revision they started from. If someone wrote meanwhile the server answers `409` and the app pulls and merges again. The server keeps the last 20 team parts, so a value overwritten by the merge can still be recovered by hand.

## Members and roles

| Role                    | Can                                                 |
| ----------------------- | --------------------------------------------------- |
| Owner (Proprietario)    | everything, including members, roles and the name   |
| Editor (Può modificare) | change the team part, fingerprints included         |
| Viewer (Sola lettura)   | read the team part and connect with own credentials |

The server enforces roles on writes; the app refuses a viewer's edit to the team part earlier, with `ModelError::ReadOnly`. Only editors change fingerprints, because a swapped shared fingerprint would let a man-in-the-middle in for the whole team. A viewer can read shared credentials: that is what sharing them means.

### Removing a member

1. The owner's app makes a new vault key, re-encrypts the team part and the name, and seals the new key to everyone left.
2. `POST /vaults/<id>/rotate` swaps it in as one write: new key epoch, members, contents. The removed member's private part is deleted.
3. The app lists the shared identities and keys the removed member could read, since the new key does not protect a secret they already saw.

Other devices notice the new epoch at their next sync and unseal the new key.

## Server

Plain Node with no dependencies, TypeScript run directly (`sync/`). Storage is JSON files with atomic writes and one write queue; accounts and vault records stay in memory. See the README for the layout, limits and API.

- **Invites only**: `node server.ts invite --admin` for the first account; admins invite from the app.
- **Devices**: each login is a device session with a random token, stored as a hash. The app lists and revokes them.
- **Rate limit**: failed logins per username and address together (10 in 15 minutes) and per address (200, across usernames). None per username alone, which would let anyone lock a known user out. Unknown usernames are checked against a decoy verifier, so their replies take as long as a wrong password. Behind Caddy the address is the last `X-Forwarded-For` entry, which the proxy appends; earlier entries come from the client and are ignored.
- **Deployment**: `sync/compose.yaml` with Caddy for HTTPS.

### Why plain Node

The server routes about twenty requests and checks shapes and roles; the cryptography that matters runs on the devices. Node's `http` and `crypto` cover it, the Docker image is `node:24-alpine` with no `npm install`, and there is no dependency to audit or update. A framework would add routing and body parsing we already have in a few dozen lines, and the load (a few people polling every 30 seconds) is far from where framework or runtime speed matters. scrypt on login is the most expensive request, and libuv's thread pool caps how many run at once.

## Not done

- Push instead of polling: not needed at this size.
- A viewer accepting a changed fingerprint for themselves only.
- Hiding sizes and timing from the server (padding).
