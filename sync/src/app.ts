import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createLimiter,
  decoySalt,
  makeVerifier,
  newId,
  newToken,
  tokenHash,
  verify,
} from "./auth.ts";
import {
  MAX_SMALL_BYTES,
  MAX_VAULT_BYTES,
  httpError,
  isHttpError,
  readJson,
  reply,
} from "./http.ts";
import {
  isBase64,
  isBox,
  isDeviceName,
  isId,
  isRevision,
  isRole,
  isSealed,
  isUsername,
} from "./shapes.ts";
import { openStore } from "./store.ts";
import type { Role } from "./shapes.ts";
import type { Device, Store, User, Vault } from "./store.ts";

export const INVITE_DAYS = 7;
const MAX_DEVICES = 20;
// Persisting "last seen" on every request would rewrite the account file each time.
const LAST_SEEN_STEP_MS = 60 * 60 * 1000;

type Body = Record<string, unknown>;
type Context = {
  req: IncomingMessage;
  res: ServerResponse;
  params: string[];
  body: () => Promise<Body>;
};
type Authed = Context & { user: User; device: Device };

const key32 = (value: unknown, field: string) => {
  if (!isBase64(value, { length: 32 }))
    throw httpError(400, `Invalid ${field}`);
  return Buffer.from(value, "base64");
};
const check = <T>(ok: boolean, value: T, field: string) => {
  if (!ok) throw httpError(400, `Invalid ${field}`);
  return value;
};

/** What a device learns about its own account at login. */
const account = (user: User) => ({
  id: user.id,
  username: user.username,
  admin: user.admin,
  salt: user.salt,
  publicKey: user.publicKey,
  keys: { password: user.keys.password, privateKey: user.keys.privateKey },
});

const vaultFor = (vault: Vault, userId: string) => {
  const member = vault.members[userId];
  return {
    id: vault.id,
    role: member.role,
    meta: vault.meta,
    keyEpoch: vault.keyEpoch,
    sealedKey: member.sealedKey,
    revision: vault.revision,
    members: Object.keys(vault.members).length,
  };
};

const owners = (vault: Vault) =>
  Object.values(vault.members).filter((m) => m.role === "owner").length;

/**
 * Builds the HTTP server (not yet listening). Accounts and roles are enforced
 * here; everything a vault contains is encrypted on the devices.
 */
export async function createSyncServer({
  directory,
  onError = () => {},
  now = Date.now,
}: {
  directory: string;
  onError?: (error: unknown) => void;
  now?: () => number;
}) {
  const store = await openStore(directory);
  const logins = createLimiter({ attempts: 10, windowMs: 15 * 60 * 1000, now });
  const routes = createRoutes(store, logins, now);

  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Refuse without reading a body we do not want: answer, then drop the connection.
    const reject = (status: number, error: string) => {
      res.setHeader("Connection", "close");
      reply(res, status, { error });
      res.once("finish", () => req.destroy());
    };
    const path = (req.url ?? "").split("?")[0];
    if (req.method === "GET" && path === "/health")
      return reply(res, 200, { ok: true });
    const match = routes.find(
      (r) => r.method === req.method && r.pattern.test(path),
    );
    if (!match) return reject(404, "Not found");
    const params = match.pattern.exec(path)!.slice(1);
    try {
      const context: Context = {
        req,
        res,
        params,
        body: () => readJson(req, match.max ?? MAX_SMALL_BYTES),
      };
      if (match.public) return await match.handle(context as Authed);
      const authed = authenticate(store, req, now);
      if (!authed) return reject(401, "Unauthorized");
      await match.handle({ ...context, ...authed });
    } catch (error) {
      if (isHttpError(error)) return reject(error.status, error.message);
      onError(error);
      if (!res.headersSent) reply(res, 500, { error: "Storage unavailable" });
      else res.destroy();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 32;
  return server;
}

function authenticate(store: Store, req: IncomingMessage, now: () => number) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return undefined;
  const found = store.userByToken(tokenHash(header.slice(7)));
  if (found && now() - found.device.lastSeenAt > LAST_SEEN_STEP_MS) {
    found.device.lastSeenAt = now();
    void store.serialized(() => store.saveUser(found.user)).catch(() => {});
  }
  return found;
}

type Route = {
  method: string;
  pattern: RegExp;
  public?: boolean;
  max?: number;
  handle: (context: Authed) => Promise<void>;
};

function createRoutes(
  store: Store,
  logins: ReturnType<typeof createLimiter>,
  now: () => number,
): Route[] {
  const VAULT = "([0-9a-f]{32})";
  const route = (
    method: string,
    path: string,
    handle: Route["handle"],
    options: Partial<Route> = {},
  ): Route => ({
    method,
    pattern: new RegExp(`^/api${path}$`),
    handle,
    ...options,
  });

  const newDevice = (user: User, name: unknown) => {
    const token = newToken();
    const device: Device = {
      id: newId(),
      name: check(isDeviceName(name), name as string, "device").trim(),
      tokenHash: tokenHash(token),
      createdAt: now(),
      lastSeenAt: now(),
    };
    // The oldest sessions go first when a user keeps logging in from new devices.
    user.devices = [...user.devices, device].slice(-MAX_DEVICES);
    return { token, deviceId: device.id };
  };

  // A wrong password and an unknown user look the same, and both count against the limit.
  const checkLogin = async (
    username: unknown,
    secret: Buffer,
    field: "auth" | "recoveryAuth",
  ) => {
    if (!isUsername(username)) throw httpError(400, "Invalid username");
    if (logins.blocked(username)) throw httpError(429, "Too many attempts");
    const user = store.userByName(username);
    if (!user || !(await verify(secret, user[field]))) {
      logins.fail(username);
      throw httpError(401, "Wrong username or password");
    }
    logins.clear(username);
    return user;
  };

  const memberOf = (user: User, id: string) => {
    const vault = store.vaults.get(id);
    if (!vault?.members[user.id]) throw httpError(404, "No vault");
    return vault;
  };
  const allowed = (vault: Vault, user: User, roles: string[]) => {
    if (!roles.includes(vault.members[user.id].role))
      throw httpError(403, "Not allowed");
  };

  return [
    route(
      "POST",
      "/prelogin",
      async ({ res, body }) => {
        const { username } = await body();
        if (!isUsername(username)) throw httpError(400, "Invalid username");
        const user = store.userByName(username);
        reply(res, 200, {
          salt: user?.salt ?? decoySalt(store.secret, username),
        });
      },
      { public: true },
    ),
    route(
      "POST",
      "/login",
      async ({ res, body }) => {
        const { username, authKey, device } = await body();
        const secret = key32(authKey, "authKey");
        const user = await checkLogin(username, secret, "auth");
        await store.serialized(async () => {
          const session = newDevice(user, device);
          await store.saveUser(user);
          reply(res, 200, { ...session, account: account(user) });
        });
      },
      { public: true },
    ),
    // A device that missed a password change opens its account with the new password: the keys, no new session.
    route(
      "POST",
      "/login/keys",
      async ({ res, body }) => {
        const { username, authKey } = await body();
        const user = await checkLogin(
          username,
          key32(authKey, "authKey"),
          "auth",
        );
        reply(res, 200, account(user));
      },
      { public: true },
    ),
    route(
      "POST",
      "/register",
      async ({ res, body }) => {
        const b = await body();
        if (!isUsername(b.username)) throw httpError(400, "Invalid username");
        const auth = await makeVerifier(key32(b.authKey, "authKey"));
        const recoveryAuth = await makeVerifier(
          key32(b.recoveryAuth, "recoveryAuth"),
        );
        const keys = b.keys as Record<string, unknown> | undefined;
        check(
          isBase64(b.salt, { length: 16 }) &&
            isBase64(b.publicKey, { length: 32 }) &&
            isBox(keys?.password) &&
            isBox(keys?.recovery) &&
            isBox(keys?.privateKey) &&
            typeof b.invite === "string",
          null,
          "account",
        );
        await store.serialized(async () => {
          if (store.userByName(b.username as string))
            throw httpError(409, "Username taken");
          const invite = await store.takeInvite(tokenHash(b.invite as string));
          if (!invite || invite.expiresAt < now())
            throw httpError(403, "Invalid invite");
          const user: User = {
            id: newId(),
            username: b.username as string,
            admin: invite.admin,
            salt: b.salt as string,
            auth,
            recoveryAuth,
            publicKey: b.publicKey as string,
            keys: keys as User["keys"],
            devices: [],
            createdAt: now(),
          };
          const session = newDevice(user, b.device);
          await store.saveUser(user);
          reply(res, 200, { ...session, account: account(user) });
        });
      },
      { public: true },
    ),
    // Recovery in two steps: the recovery key proves the account and unwraps the account key, then a new password replaces the old one.
    route(
      "POST",
      "/recover/start",
      async ({ res, body }) => {
        const { username, recoveryAuth } = await body();
        const user = await checkLogin(
          username,
          key32(recoveryAuth, "recoveryAuth"),
          "recoveryAuth",
        );
        reply(res, 200, { recovery: user.keys.recovery, salt: user.salt });
      },
      { public: true },
    ),
    route(
      "POST",
      "/recover/finish",
      async ({ res, body }) => {
        const b = await body();
        const user = await checkLogin(
          b.username,
          key32(b.recoveryAuth, "recoveryAuth"),
          "recoveryAuth",
        );
        const auth = await makeVerifier(key32(b.authKey, "authKey"));
        check(
          isBase64(b.salt, { length: 16 }) && isBox(b.password),
          null,
          "password",
        );
        await store.serialized(async () => {
          user.salt = b.salt as string;
          user.auth = auth;
          user.keys = {
            ...user.keys,
            password: b.password as User["keys"]["password"],
          };
          // Whoever knew the old password may hold a session: every device signs in again.
          user.devices = [];
          const session = newDevice(user, b.device);
          await store.saveUser(user);
          reply(res, 200, { ...session, account: account(user) });
        });
      },
      { public: true },
    ),
    route("GET", "/account", async ({ res, user }) =>
      reply(res, 200, account(user)),
    ),
    route("POST", "/account/password", async ({ res, body, user }) => {
      const b = await body();
      await checkLogin(
        user.username,
        key32(b.currentAuthKey, "authKey"),
        "auth",
      );
      const auth = await makeVerifier(key32(b.authKey, "authKey"));
      check(
        isBase64(b.salt, { length: 16 }) && isBox(b.password),
        null,
        "password",
      );
      await store.serialized(async () => {
        user.salt = b.salt as string;
        user.auth = auth;
        user.keys = {
          ...user.keys,
          password: b.password as User["keys"]["password"],
        };
        await store.saveUser(user);
        reply(res, 200, account(user));
      });
    }),
    route("POST", "/logout", async ({ res, user, device }) => {
      await store.serialized(async () => {
        user.devices = user.devices.filter((d) => d.id !== device.id);
        await store.saveUser(user);
      });
      reply(res, 200, { ok: true });
    }),
    route("GET", "/devices", async ({ res, user, device }) =>
      reply(
        res,
        200,
        user.devices.map((d) => ({
          id: d.id,
          name: d.name,
          createdAt: d.createdAt,
          lastSeenAt: d.lastSeenAt,
          current: d.id === device.id,
        })),
      ),
    ),
    route(
      "DELETE",
      "/devices/([0-9a-f]{32})",
      async ({ res, user, params }) => {
        await store.serialized(async () => {
          user.devices = user.devices.filter((d) => d.id !== params[0]);
          await store.saveUser(user);
        });
        reply(res, 200, { ok: true });
      },
    ),
    route("POST", "/invites", async ({ res, body, user }) => {
      if (!user.admin) throw httpError(403, "Not allowed");
      const { admin } = await body();
      const code = newToken();
      await store.serialized(() =>
        store.writeInvite(tokenHash(code), {
          admin: admin === true,
          expiresAt: now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
        }),
      );
      reply(res, 200, { code });
    }),
    route(
      "GET",
      "/users/([a-z0-9][a-z0-9._-]{1,31})",
      async ({ res, params }) => {
        const found = store.userByName(params[0]);
        if (!found) throw httpError(404, "No user");
        reply(res, 200, {
          id: found.id,
          username: found.username,
          publicKey: found.publicKey,
        });
      },
    ),
    route("GET", "/vaults", async ({ res, user }) =>
      reply(
        res,
        200,
        [...store.vaults.values()]
          .filter((v) => v.members[user.id])
          .map((v) => vaultFor(v, user.id)),
      ),
    ),
    route(
      "POST",
      "/vaults",
      async ({ res, body, user }) => {
        const b = await body();
        check(
          isId(b.id) &&
            isBox(b.meta) &&
            isSealed(b.sealedKey) &&
            isBox(b.envelope),
          null,
          "vault",
        );
        await store.serialized(async () => {
          if (store.vaults.has(b.id as string))
            throw httpError(409, "Vault exists");
          const vault: Vault = {
            id: b.id as string,
            meta: b.meta as Vault["meta"],
            keyEpoch: 1,
            revision: 1,
            members: {
              [user.id]: { role: "owner", sealedKey: b.sealedKey as never },
            },
            createdAt: now(),
          };
          await store.writeData(vault.id, {
            revision: 1,
            envelope: b.envelope as never,
          });
          await store.saveVault(vault);
          reply(res, 200, vaultFor(vault, user.id));
        });
      },
      { max: MAX_VAULT_BYTES },
    ),
    route("GET", `/vaults/${VAULT}`, async ({ res, user, params }) => {
      const vault = memberOf(user, params[0]);
      const stored = await store.readData(vault.id);
      reply(res, 200, {
        ...vaultFor(vault, user.id),
        envelope: stored?.envelope ?? null,
      });
    }),
    route("DELETE", `/vaults/${VAULT}`, async ({ res, user, params }) => {
      await store.serialized(async () => {
        const vault = memberOf(user, params[0]);
        allowed(vault, user, ["owner"]);
        await store.deleteVault(vault.id);
      });
      reply(res, 200, { ok: true });
    }),
    route(
      "PUT",
      `/vaults/${VAULT}/data`,
      async ({ res, body, user, params }) => {
        const b = await body();
        check(isRevision(b.revision) && isBox(b.envelope), null, "data");
        await store.serialized(async () => {
          const vault = memberOf(user, params[0]);
          allowed(vault, user, ["owner", "editor"]);
          if (b.keyEpoch !== vault.keyEpoch)
            throw httpError(409, "Key changed");
          if (b.revision !== vault.revision)
            throw httpError(409, "Stale revision");
          const revision = vault.revision + 1;
          await store.writeData(vault.id, {
            revision,
            envelope: b.envelope as never,
          });
          await store.saveVault({ ...vault, revision });
          reply(res, 200, { revision });
        });
      },
      { max: MAX_VAULT_BYTES },
    ),
    route(
      "PUT",
      `/vaults/${VAULT}/meta`,
      async ({ res, body, user, params }) => {
        const b = await body();
        check(isBox(b.meta), null, "meta");
        await store.serialized(async () => {
          const vault = memberOf(user, params[0]);
          allowed(vault, user, ["owner"]);
          if (b.keyEpoch !== vault.keyEpoch)
            throw httpError(409, "Key changed");
          await store.saveVault({ ...vault, meta: b.meta as Vault["meta"] });
          reply(res, 200, { ok: true });
        });
      },
    ),
    route("GET", `/vaults/${VAULT}/private`, async ({ res, user, params }) => {
      const vault = memberOf(user, params[0]);
      reply(res, 200, (await store.readPrivate(vault.id, user.id)) ?? null);
    }),
    route(
      "PUT",
      `/vaults/${VAULT}/private`,
      async ({ res, body, user, params }) => {
        const b = await body();
        check(isRevision(b.revision) && isBox(b.envelope), null, "data");
        await store.serialized(async () => {
          const vault = memberOf(user, params[0]);
          const current =
            (await store.readPrivate(vault.id, user.id))?.revision ?? 0;
          if (b.revision !== current) throw httpError(409, "Stale revision");
          await store.writePrivate(vault.id, user.id, {
            revision: current + 1,
            envelope: b.envelope as never,
          });
          reply(res, 200, { revision: current + 1 });
        });
      },
      { max: MAX_VAULT_BYTES },
    ),
    route("GET", `/vaults/${VAULT}/members`, async ({ res, user, params }) => {
      const vault = memberOf(user, params[0]);
      reply(
        res,
        200,
        Object.entries(vault.members).map(([id, m]) => {
          const member = store.users.get(id);
          return {
            userId: id,
            username: member?.username ?? "",
            publicKey: member?.publicKey ?? "",
            role: m.role,
          };
        }),
      );
    }),
    // Adds a member (with the vault key sealed to them) or changes a role. Removing someone else goes through /rotate.
    route(
      "PUT",
      `/vaults/${VAULT}/members/([0-9a-f]{32})`,
      async ({ res, body, user, params }) => {
        const b = await body();
        const role = check(isRole(b.role), b.role as Role, "role");
        await store.serialized(async () => {
          const vault = memberOf(user, params[0]);
          allowed(vault, user, ["owner"]);
          const target = store.users.get(params[1]);
          if (!target) throw httpError(404, "No user");
          const existing = vault.members[target.id];
          if (!existing) {
            if (b.keyEpoch !== vault.keyEpoch)
              throw httpError(409, "Key changed");
            check(isSealed(b.sealedKey), null, "sealedKey");
          }
          const members = {
            ...vault.members,
            [target.id]: {
              role,
              sealedKey: existing?.sealedKey ?? (b.sealedKey as never),
            },
          };
          if (!owners({ ...vault, members }))
            throw httpError(409, "Last owner");
          await store.saveVault({ ...vault, members });
          reply(res, 200, { ok: true });
        });
      },
    ),
    route(
      "DELETE",
      `/vaults/${VAULT}/members/me`,
      async ({ res, user, params }) => {
        await store.serialized(async () => {
          const vault = memberOf(user, params[0]);
          const members = { ...vault.members };
          delete members[user.id];
          if (!owners({ ...vault, members }))
            throw httpError(409, "Last owner");
          await store.saveVault({ ...vault, members });
          await store.removePrivate(vault.id, user.id);
        });
        reply(res, 200, { ok: true });
      },
    ),
    // Removes members and replaces the vault key in one write: new contents, name and sealed keys for everyone left.
    route(
      "POST",
      `/vaults/${VAULT}/rotate`,
      async ({ res, body, user, params }) => {
        const b = await body();
        const sealed = (b.sealedKeys ?? {}) as Record<string, unknown>;
        const remove = Array.isArray(b.remove) ? b.remove : [];
        check(
          isRevision(b.revision) &&
            isBox(b.envelope) &&
            isBox(b.meta) &&
            remove.every(isId) &&
            Object.values(sealed).every(isSealed),
          null,
          "rotation",
        );
        await store.serialized(async () => {
          const vault = memberOf(user, params[0]);
          allowed(vault, user, ["owner"]);
          if (b.keyEpoch !== vault.keyEpoch + 1)
            throw httpError(409, "Key changed");
          if (b.revision !== vault.revision)
            throw httpError(409, "Stale revision");
          const remaining = Object.keys(vault.members).filter(
            (id) => !remove.includes(id),
          );
          if (
            remaining.length !== Object.keys(sealed).length ||
            !remaining.every((id) => id in sealed)
          )
            throw httpError(409, "Members changed");
          const members = Object.fromEntries(
            remaining.map((id) => [
              id,
              { role: vault.members[id].role, sealedKey: sealed[id] as never },
            ]),
          );
          if (!owners({ ...vault, members }))
            throw httpError(409, "Last owner");
          const revision = vault.revision + 1;
          await store.writeData(vault.id, {
            revision,
            envelope: b.envelope as never,
          });
          for (const id of remove)
            await store.removePrivate(vault.id, id as string);
          await store.saveVault({
            ...vault,
            meta: b.meta as Vault["meta"],
            keyEpoch: vault.keyEpoch + 1,
            revision,
            members,
          });
          reply(res, 200, { revision, keyEpoch: vault.keyEpoch + 1 });
        });
      },
      { max: MAX_VAULT_BYTES },
    ),
  ];
}
