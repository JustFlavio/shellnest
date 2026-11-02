# Sync v2: accounts and shared vaults (design)

Status: proposal, nothing implemented. The current sync (one token, whole-vault upload) is described in `sync/README.md`.

## Why

The current sync was built for one person:

- one token for the whole server, no users;
- a second device needs the full `/vaults/<id>` URL, the token and the master password;
- a vault travels as one encrypted blob, so two devices that both changed it stop with a conflict and nothing is merged.

The goal is a sync that a team of a few people can self-host, where:

1. a new device of the same person needs only **server address, username and password**;
2. hosts can be shared with colleagues, with the credentials either **shared** or **personal**, chosen per host or folder;
3. two people editing different hosts never conflict;
4. the server still never sees decrypted data.

The model is the one used by Termius and Bitwarden: a personal vault per user, team vaults shared with chosen members, end-to-end encryption.

## Vaults

| Vault            | Who sees it                    | Holds                                                                                |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| Personal         | the user, on all their devices | their hosts, identities, keys, workspaces, bindings to shared hosts, per-user state  |
| Team (0 or more) | its members                    | shared hosts, folders, tags, fingerprints, and optionally shared identities and keys |

A user can own several vaults, as today; each one is personal or shared. There is no per-vault password any more: the account unlocks every vault the user can see.

### Credentials of a shared host

A host in a team vault takes its credentials from one of two places:

- **Team**: `identity_id` points to an identity (or key) **in the same team vault**. Every member connects with it. For service accounts (`deploy`, a shared `root` key).
- **Personal**: `identity_id` and `credentials` are empty. Each member binds their own identity in their personal vault. For people with their own user on the server.

A host never references an identity in another vault. The client enforces it in `model/validate.rs`; the server cannot, since it sees only ciphertext.

### Bindings

A binding is a personal-vault record:

```
Binding { vault_id, scope: "vault" | "group" | "host", target_id, identity_id }
```

To connect to a shared host with personal credentials, the client takes the most specific binding: host, then its folder and the parent folders, then the whole vault. With no binding, the connection asks "User / Access method" like a quick connection and offers to save the answer as a binding. Binding a whole vault once covers the usual case of 50 servers with the same personal user.

Resolving bindings is pure logic and lives next to `model/resolve.rs` with its tests.

### Per-user state

`last_connected_at` moves out of `Host` into a personal-vault record keyed by `(vault_id, host_id)`. Otherwise every connection would write a shared record and colleagues would conflict all day. `os` stays on the host: it is shared knowledge and changes rarely.

## Keys

All randomness from the OS RNG, all symmetric encryption XChaCha20-Poly1305 as today.

```
password ──Argon2id(salt)──► master key ──HKDF──► auth key   (sent to the server at login)
                                          └─HKDF──► wrap key   (never leaves the device)

account key (random)      wrapped by wrap key, and by the recovery key
user key pair (X25519)    private half encrypted with the account key, public half on the server
vault key (random)        per vault; sealed to each member's public key
item                      encrypted with its vault key
```

- **Login**: the client asks the server for the account's Argon2 salt and parameters, derives the auth key and sends it. The server stores a scrypt hash of it (`node:crypto`) and compares in constant time. For unknown usernames the server returns a salt derived from a server secret, so the reply does not reveal which accounts exist.
- **Password change**: re-wrap the account key; no vault is re-encrypted.
- **Recovery key**: 32 random bytes shown once at sign-up, to print or store in a password manager. It also wraps the account key. Without the password and the recovery key the data is lost: the administrator cannot reset a password and keep the data.
- **Sealing a vault key**: ephemeral X25519, HKDF-SHA256, XChaCha20-Poly1305, with the vault id and member id in the AAD.
- **Item AAD**: `shellnest:item:1`, vault id, item id and kind. The server cannot move an item to another vault or change its kind without the decryption failing.
- Keys are `Zeroizing` on the Rust side, like the current vault key. The OS keychain keeps the account key for "remember me", as it keeps the vault key now.

### Trusting a colleague's public key

The server hands out public keys, so a compromised server could hand out its own. Each user has a **safety code** (a short hash of their public key) shown in the profile and in the invite dialog; comparing it out of band (in person, on a call) rules out the swap. The client pins a key the first time it uses it and warns if it changes. Comparing codes is optional in the first version.

## Items and sync

Each host, folder, identity, key, workspace, binding and per-user state is one **item**:

```
Item { id, vault_id, kind, seq, deleted, nonce, ciphertext }
```

- `id` is a random UUID made by the client. `seq` is set by the server from a counter per vault that only goes up.
- **Pull**: `GET /v2/vaults/<id>/items?since=<seq>` returns every item changed after the cursor, deletions included. The client keeps the cursor per vault.
- **Push**: `POST /v2/vaults/<id>/items` with a batch of `{ id, base_seq, … }`. The server applies the whole batch or nothing, and refuses an item whose `base_seq` is no longer current. A batch keeps linked items together (a new host and its new identity).
- The client polls every 30 seconds while unlocked, as now, and after each local change.

### Conflicts

A conflict now concerns one item, not the vault:

- both sides changed the same item: the client keeps both and asks which one to keep, showing the two versions;
- one side deleted it and the other changed it: the change wins and the item comes back, with a notice;
- a push refused because a referenced item was deleted (host → identity): the client pulls, then asks.

Local changes are never dropped without asking.

### Local storage

The device keeps an encrypted copy of every item and the cursors, so the app works offline and without a server, as today. The same format is used with or without an account: an offline user has a local account that nobody else knows about, and signing in to a server later uploads it.

## Members and roles

| Role   | Can                                                                                       |
| ------ | ----------------------------------------------------------------------------------------- |
| Owner  | everything, including members and deleting the vault                                      |
| Editor | create, change and delete items, including host fingerprints                              |
| Viewer | read and connect; a changed fingerprint blocks the connection until an editor confirms it |

The server enforces roles on writes. A viewer can still read shared credentials: that is the point of sharing them.

Only editors change fingerprints, because a shared fingerprint that someone swapped would let a man-in-the-middle in for the whole team.

### Removing a member

1. The owner removes the member; the server stops serving them the vault at once.
2. The client makes a new vault key, re-encrypts every item, seals the new key to the remaining members, and the server swaps it in as one write (a key epoch).
3. The client lists the **team identities and keys** that the member could read, since those must also be changed on the servers. The new vault key does not protect a secret that person has already read.

With personal credentials only, step 3 lists nothing.

## Server

Still plain Node with no dependencies, TypeScript run directly. Storage moves from JSON files to `node:sqlite` (built in; Node 24 in the Docker image), tables `users`, `devices`, `invites`, `vaults`, `members`, `items`.

- **First start**: `node server.ts admin create <username>` prints a one-time link to set the password.
- **Invites**: `node server.ts admin invite` (or an owner from the app) creates a link `https://sync.example.com/invite/<code>`, single use, valid 7 days. The colleague pastes it in the app, picks a username and password, and gets the recovery key. No open sign-up.
- **Devices**: each login creates a device session (random token, stored hashed). The app lists the user's devices and can revoke one; a lost laptop loses access at its next request.
- **Rate limit**: failed logins are limited per username and per IP in memory.
- **Deployment**: one `docker compose` file with the server and Caddy for HTTPS.
- **Backups**: one SQLite file; `VACUUM INTO` gives a consistent copy while running. Its contents are encrypted, apart from the metadata below.

### What the server sees

Usernames, who belongs to which vault and with which role, how many items each vault has, their sizes and kinds, when they change, device names and IP addresses. Not hostnames, addresses, users, passwords, keys, folder names or tags.

`kind` is visible so the server can return items in a sensible order; it can be moved inside the ciphertext if that metadata matters more than the convenience.

### API (sketch)

| Request                                      | Purpose                                      |
| -------------------------------------------- | -------------------------------------------- |
| `POST /v2/prelogin`                          | salt and Argon2 parameters for a username    |
| `POST /v2/login`, `POST /v2/logout`          | device session                               |
| `POST /v2/invites/<code>`                    | accept an invite, create the account         |
| `GET /v2/me`, `PUT /v2/me/keys`              | wrapped account key, key pair, recovery wrap |
| `GET /v2/devices`, `DELETE /v2/devices/<id>` | list and revoke devices                      |
| `GET /v2/vaults`, `POST /v2/vaults`          | vaults the user can see, with sealed keys    |
| `GET/POST /v2/vaults/<id>/items`             | pull and push                                |
| `GET/PUT/DELETE /v2/vaults/<id>/members`     | members, roles, sealed keys                  |
| `POST /v2/vaults/<id>/rotate`                | swap in a new key epoch                      |
| `GET /v2/users/<name>/public-key`            | for inviting a member                        |

## Migration

- The local format changes (items and wrapped keys instead of one envelope per vault), so this is a schema migration, like the one to schema 6: an encrypted `.pre-v7.bak` copy before rewriting, and old clients cannot read the new format. Every device must be updated before syncing again.
- Existing local vaults each have their own password. When moving to an account, the user unlocks each one once and it is imported as a vault of the account.
- Sync v1 keeps working on the server during the change (its `/vault` and `/vaults/<id>` routes stay as they are). A v1-synced vault is imported by pulling it with its URL and token one last time. The v1 routes are removed in a later release.
- The current `AAD` and v1 envelope code stay, to read the old files during import.

## Phases

1. **Accounts and devices.** Sign-up by invite, login, device list, recovery key, local account. The vault is still one item per vault, so a user's own devices sync with nothing but username and password. Done when a second device is set up with address, username and password only.
2. **Items.** One item per record, pull and push by cursor, conflicts per item, migration of existing vaults. Done when two devices editing different hosts at the same time never conflict.
3. **Team vaults.** Key pairs, sealed vault keys, members and roles, "credentials from: team / personal", bindings, per-user state, safety codes. Done when a colleague sees a shared folder of hosts and connects with either shared or their own credentials.
4. **Administration.** Removing members with key rotation and the list of secrets to change, revoking devices from the app, compose file and backup instructions.

## Open questions

- Should a viewer be able to accept a changed fingerprint for themselves only (a personal override), or always wait for an editor?
- Push instead of polling (Server-Sent Events) is not needed for a team of this size; keep polling unless it proves slow.
- Should `kind` and item sizes be hidden from the server (padding, kind inside the ciphertext)?
