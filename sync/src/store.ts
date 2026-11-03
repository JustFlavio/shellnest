import { randomBytes } from "node:crypto";
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Verifier } from "./auth.ts";
import type { Box, Role, Sealed } from "./shapes.ts";

export type Device = {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: number;
  lastSeenAt: number;
};
export type User = {
  id: string;
  username: string;
  admin: boolean;
  /** Argon2 salt the client derives its login and wrapping keys with. */
  salt: string;
  auth: Verifier;
  recoveryAuth: Verifier;
  publicKey: string;
  /** The account key wrapped by the password and by the recovery key; the X25519 private key. */
  keys: { password: Box; recovery: Box; privateKey: Box };
  devices: Device[];
  createdAt: number;
};
export type Member = { role: Role; sealedKey: Sealed };
export type Vault = {
  id: string;
  /** The vault name, encrypted with the vault key. */
  meta: Box;
  keyEpoch: number;
  revision: number;
  members: Record<string, Member>;
  createdAt: number;
};
export type Stored = { revision: number; envelope: Box };
export type Invite = { admin: boolean; expiresAt: number };

/** Versions of a vault's contents kept besides the current one, for manual recovery. */
export const HISTORY = 20;

/**
 * Everything the server keeps, as JSON files under one directory:
 *
 *   secret                         random bytes for decoy salts
 *   users/<id>.json                accounts, their wrapped keys and devices
 *   invites/<sha256 of code>.json  pending invites (also written by `server.ts invite`)
 *   vaults/<id>.json               members, sealed keys, revision
 *   data/<id>.json                 the encrypted contents of a vault
 *   history/<id>/<revision>.json   previous contents, the last HISTORY ones
 *   private/<id>/<user>.json       one member's private part of a vault
 *
 * Accounts and vault records stay in memory; contents are read on demand.
 * Every change goes through one queue, so a check and the write that follows
 * it are atomic with respect to every other request.
 */
export async function openStore(directory: string) {
  for (const sub of [
    "users",
    "invites",
    "vaults",
    "data",
    "history",
    "private",
  ])
    await mkdir(join(directory, sub), { recursive: true, mode: 0o700 });
  const secret = await loadSecret(join(directory, "secret"));
  const users = new Map<string, User>();
  const vaults = new Map<string, Vault>();
  for (const user of await readAll<User>(join(directory, "users")))
    users.set(user.id, user);
  for (const vault of await readAll<Vault>(join(directory, "vaults")))
    vaults.set(vault.id, vault);

  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(task: () => Promise<T>) => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };
  const file = (...parts: string[]) => join(directory, ...parts);
  const userFile = (id: string) => file("users", `${id}.json`);
  const vaultFile = (id: string) => file("vaults", `${id}.json`);
  const dataFile = (id: string) => file("data", `${id}.json`);
  const privateFile = (id: string, user: string) =>
    file("private", id, `${user}.json`);

  const store = {
    secret,
    serialized,
    users,
    vaults,
    userByName: (username: string) =>
      [...users.values()].find((u) => u.username === username),
    userByToken: (hash: string) => {
      for (const user of users.values()) {
        const device = user.devices.find((d) => d.tokenHash === hash);
        if (device) return { user, device };
      }
      return undefined;
    },
    saveUser: async (user: User) => {
      await writeJson(userFile(user.id), user);
      users.set(user.id, user);
    },
    saveVault: async (vault: Vault) => {
      await writeJson(vaultFile(vault.id), vault);
      vaults.set(vault.id, vault);
    },
    readData: (id: string) => readJson<Stored>(dataFile(id)),
    /** Writes new contents and keeps the replaced ones in the history. */
    writeData: async (id: string, stored: Stored) => {
      const previous = await readJson<Stored>(dataFile(id));
      if (previous) {
        const dir = file("history", id);
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await writeJson(join(dir, `${previous.revision}.json`), previous);
        const old = (await readdir(dir))
          .map((name) => Number.parseInt(name, 10))
          .filter(Number.isSafeInteger)
          .sort((a, b) => b - a)
          .slice(HISTORY);
        for (const revision of old) await unlink(join(dir, `${revision}.json`));
      }
      await writeJson(dataFile(id), stored);
    },
    readPrivate: (id: string, user: string) =>
      readJson<Stored>(privateFile(id, user)),
    writePrivate: async (id: string, user: string, stored: Stored) => {
      await mkdir(file("private", id), { recursive: true, mode: 0o700 });
      await writeJson(privateFile(id, user), stored);
    },
    removePrivate: (id: string, user: string) =>
      rm(privateFile(id, user), { force: true }),
    deleteVault: async (id: string) => {
      await rm(vaultFile(id), { force: true });
      vaults.delete(id);
      for (const path of [
        dataFile(id),
        file("history", id),
        file("private", id),
      ])
        await rm(path, { recursive: true, force: true });
    },
    writeInvite: (hash: string, invite: Invite) =>
      writeJson(file("invites", `${hash}.json`), invite),
    /** Reads and deletes an invite in one step: it works once. Read from disk, so the CLI can add one while running. */
    takeInvite: async (hash: string) => {
      const path = file("invites", `${hash}.json`);
      const invite = await readJson<Invite>(path);
      if (invite) await rm(path, { force: true });
      return invite;
    },
  };
  return store;
}
export type Store = Awaited<ReturnType<typeof openStore>>;

async function loadSecret(path: string) {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const secret = randomBytes(32);
  await replace(path, secret);
  return secret;
}

async function readAll<T>(dir: string) {
  const values: T[] = [];
  for (const name of await readdir(dir))
    if (name.endsWith(".json")) {
      const value = await readJson<T>(join(dir, name));
      if (value) values.push(value);
    }
  return values;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse((await readFile(path)).toString()) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

const writeJson = (path: string, value: unknown) =>
  replace(path, Buffer.from(JSON.stringify(value)));

// Write to a temporary file, then rename: a crash leaves the old or the new
// file, never a truncated one.
async function replace(path: string, bytes: Uint8Array) {
  await writeFile(`${path}.tmp`, bytes, { mode: 0o600, flush: true });
  await rename(`${path}.tmp`, path);
  // Make the rename itself durable. Not supported everywhere (Windows), so best effort.
  try {
    const dir = await open(dirname(path));
    await dir.sync().finally(() => dir.close());
  } catch {}
}
