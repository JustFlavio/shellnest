import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createSyncServer } from "./server.ts";
import { createInvite } from "./src/invite.ts";
import { HISTORY } from "./src/store.ts";

type Server = Awaited<ReturnType<typeof createSyncServer>>;
type Json = Record<string, unknown>;
type Reply = { status: number; json: Json & Json[] };
type User = {
  id: string;
  token: string;
  authKey: string;
  recoveryAuth: string;
  username: string;
};
type Api = {
  base: string;
  call: (
    method: string,
    path: string,
    body?: unknown,
    token?: string,
    headers?: Record<string, string>,
  ) => Promise<Reply>;
  register: (username: string, admin?: boolean) => Promise<User>;
  directory: string;
  restart: () => Promise<Api>;
};

const b64 = (n: number) => randomBytes(n).toString("base64");
const kdfSalt = () => `1:${b64(16)}`;
const box = () => ({ nonce: b64(24), ciphertext: b64(48) });
const sealed = () => ({
  ephemeral: b64(32),
  nonce: b64(24),
  ciphertext: b64(48),
});
const vaultId = () => randomBytes(16).toString("hex");

// Stands in for the desktop client: random bytes in the shapes it sends.
async function withServer(
  fn: (api: Api) => Promise<void>,
  options: { trustProxy?: boolean } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "shellnest-sync-"));
  let server: Server | undefined;
  const start = async (): Promise<Api> => {
    server = await createSyncServer({ directory, ...options });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const call = async (
      method: string,
      path: string,
      body?: unknown,
      token?: string,
      headers: Record<string, string> = {},
    ) => {
      const res = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, json: (await res.json()) as Reply["json"] };
    };
    const register = async (username: string, admin = false) => {
      const authKey = b64(32);
      const recoveryAuth = b64(32);
      const invite = await createInvite(directory, admin);
      const res = await call("POST", "/register", {
        invite,
        username,
        salt: kdfSalt(),
        authKey,
        recoveryAuth,
        publicKey: b64(32),
        keys: { password: box(), recovery: box(), privateKey: box() },
        device: "Test device",
      });
      assert.equal(res.status, 200, JSON.stringify(res.json));
      const token = res.json.token as string;
      const id = (res.json.account as Json).id as string;
      return { id, token, authKey, recoveryAuth, username };
    };
    return { base, call, register, directory, restart };
  };
  const restart = async () => {
    server!.closeAllConnections();
    await new Promise<void>((r) => server!.close(() => r()));
    return start();
  };
  try {
    await fn(await start());
  } finally {
    server?.closeAllConnections();
    await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
    await rm(directory, { recursive: true, force: true });
  }
}

test("accounts: invites work once, logins are checked, limited and revocable", async () => {
  await withServer(async ({ call, register, directory }) => {
    const admin = await register("admin", true);
    assert.equal(
      (await call("GET", "/account", undefined, admin.token)).json.admin,
      true,
    );

    const code = await createInvite(directory, false);
    const account = {
      invite: code,
      username: "mario",
      salt: kdfSalt(),
      authKey: b64(32),
      recoveryAuth: b64(32),
      publicKey: b64(32),
      keys: { password: box(), recovery: box(), privateKey: box() },
      device: "Laptop",
    };
    assert.equal(
      (await call("POST", "/register", { ...account, username: "admin" }))
        .status,
      409,
    );
    assert.equal((await call("POST", "/register", account)).status, 200);
    assert.equal(
      (await call("POST", "/register", { ...account, username: "luigi" }))
        .status,
      403,
    );
    assert.equal(
      (
        await call("POST", "/register", {
          ...account,
          keys: { password: "plain" },
        })
      ).status,
      400,
    );

    // Unknown users get a stable decoy salt, indistinguishable in shape from a real one.
    const real = await call("POST", "/prelogin", { username: "mario" });
    assert.equal(real.json.salt, account.salt);
    const decoy = await call("POST", "/prelogin", { username: "nobody" });
    assert.equal(
      decoy.json.salt,
      (await call("POST", "/prelogin", { username: "nobody" })).json.salt,
    );
    assert.match(decoy.json.salt as string, /^1:[A-Za-z0-9+/]{22}==$/);

    const login = (authKey: string, username = "mario") =>
      call("POST", "/login", { username, authKey, device: "Desktop" });
    assert.equal((await login(b64(32), "nobody")).status, 401);
    const good = await login(account.authKey);
    assert.equal(good.status, 200);
    assert.equal(
      ((good.json.account as Json).keys as Json).recovery,
      undefined,
    );
    for (let i = 0; i < 10; i++)
      assert.equal((await login(b64(32))).status, 401);
    assert.equal((await login(account.authKey)).status, 429);

    const token = good.json.token as string;
    const devices = await call("GET", "/devices", undefined, token);
    assert.equal(devices.json.length, 2);
    const other = devices.json.find((d) => !d.current)!;
    assert.equal(
      (await call("DELETE", `/devices/${other.id}`, undefined, token)).status,
      200,
    );
    assert.equal(
      (await call("GET", "/devices", undefined, token)).json.length,
      1,
    );
    assert.equal((await call("POST", "/logout", {}, token)).status, 200);
    assert.equal((await call("GET", "/account", undefined, token)).status, 401);

    // Only admins invite from the app.
    assert.equal((await call("POST", "/invites", {}, admin.token)).status, 200);
    const plain = await register("anna");
    assert.equal((await call("POST", "/invites", {}, plain.token)).status, 403);
  });
});

test("failed logins are limited per username and address, and per address", async () => {
  await withServer(
    async ({ call, register }) => {
      const mario = await register("mario");
      const login = (username: string, authKey: string, address: string) =>
        call(
          "POST",
          "/login",
          { username, authKey, device: "Desktop" },
          undefined,
          { "X-Forwarded-For": address },
        );
      // Someone guessing Mario's password blocks only themselves, not Mario elsewhere.
      for (let i = 0; i < 10; i++)
        assert.equal(
          (await login("mario", b64(32), "203.0.113.9")).status,
          401,
        );
      assert.equal(
        (await login("mario", mario.authKey, "203.0.113.9")).status,
        429,
      );
      assert.equal(
        (await login("mario", mario.authKey, "198.51.100.1")).status,
        200,
      );
      // A client faking the header in front of the proxy's entry gets the proxy's entry.
      assert.equal(
        (await login("mario", mario.authKey, "203.0.113.9, 198.51.100.2"))
          .status,
        200,
      );

      // Spraying guesses over many usernames from one address stops at the address limit.
      for (let i = 0; i < 200; i++)
        assert.equal(
          (await login(`user${i}`, b64(32), "192.0.2.50")).status,
          401,
        );
      assert.equal(
        (await login("mario", mario.authKey, "192.0.2.50")).status,
        429,
      );
    },
    { trustProxy: true },
  );
});

test("recovery and password change replace the login and sign every device out", async () => {
  await withServer(async ({ call, register }) => {
    const user = await register("mario");
    assert.equal(
      (
        await call("POST", "/recover/start", {
          username: "mario",
          recoveryAuth: b64(32),
        })
      ).status,
      401,
    );
    const started = await call("POST", "/recover/start", {
      username: "mario",
      recoveryAuth: user.recoveryAuth,
    });
    assert.ok(started.json.recovery);
    const authKey = b64(32);
    const finished = await call("POST", "/recover/finish", {
      username: "mario",
      recoveryAuth: user.recoveryAuth,
      salt: kdfSalt(),
      authKey,
      password: box(),
      device: "New laptop",
    });
    assert.equal(finished.status, 200);
    assert.equal(
      (await call("GET", "/account", undefined, user.token)).status,
      401,
    );
    const token = finished.json.token as string;
    const changed = await call(
      "POST",
      "/account/password",
      {
        currentAuthKey: b64(32),
        authKey: b64(32),
        salt: kdfSalt(),
        password: box(),
      },
      token,
    );
    assert.equal(changed.status, 401);
    const next = b64(32);
    const salt = kdfSalt();
    const password = box();
    assert.equal(
      (
        await call(
          "POST",
          "/account/password",
          { currentAuthKey: authKey, authKey: next, salt, password },
          token,
        )
      ).status,
      200,
    );
    // A device that missed the change gets the new wrapping, without a new session.
    const keys = (key: string) =>
      call("POST", "/login/keys", { username: "mario", authKey: key });
    assert.equal((await keys(authKey)).status, 401);
    const fetched = await keys(next);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.json.salt, salt);
    assert.deepEqual(((fetched.json as Json).keys as Json).password, password);
    assert.equal(fetched.json.token, undefined);
    assert.equal(
      (await call("GET", "/devices", undefined, token)).json.length,
      1,
    );
    assert.equal(
      (
        await call("POST", "/login", {
          username: "mario",
          authKey: next,
          device: "x",
        })
      ).status,
      200,
    );
  });
});

test("vaults: roles, revisions, private parts, history and restart", async () => {
  await withServer(async ({ call, register, directory, restart }) => {
    const owner = await register("owner");
    const editor = await register("editor");
    const viewer = await register("viewer");
    const outsider = await register("outsider");
    const id = vaultId();
    const create = { id, meta: box(), sealedKey: sealed(), envelope: box() };
    assert.equal(
      (await call("POST", "/vaults", create, owner.token)).status,
      200,
    );
    assert.equal(
      (await call("POST", "/vaults", create, owner.token)).status,
      409,
    );
    assert.equal(
      (await call("POST", "/vaults", { ...create, id: "../x" }, owner.token))
        .status,
      400,
    );
    assert.equal(
      (await call("GET", `/vaults/${id}`, undefined, outsider.token)).status,
      404,
    );

    for (const [user, role] of [
      [editor, "editor"],
      [viewer, "viewer"],
    ] as const) {
      assert.equal(
        (
          await call(
            "PUT",
            `/vaults/${id}/members/${user.id}`,
            { role, keyEpoch: 2, sealedKey: sealed() },
            owner.token,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            "PUT",
            `/vaults/${id}/members/${user.id}`,
            { role, keyEpoch: 1, sealedKey: sealed() },
            owner.token,
          )
        ).status,
        200,
      );
    }
    assert.equal(
      (
        await call(
          "PUT",
          `/vaults/${id}/members/${outsider.id}`,
          { role: "editor", keyEpoch: 1, sealedKey: sealed() },
          editor.token,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "PUT",
          `/vaults/${id}/members/${owner.id}`,
          { role: "editor" },
          owner.token,
        )
      ).status,
      409,
    );
    const members = await call(
      "GET",
      `/vaults/${id}/members`,
      undefined,
      viewer.token,
    );
    assert.deepEqual(members.json.map((m) => m.role).sort(), [
      "editor",
      "owner",
      "viewer",
    ]);

    const write = (
      token: string,
      revision: number,
      envelope = box(),
      keyEpoch = 1,
    ) =>
      call(
        "PUT",
        `/vaults/${id}/data`,
        { revision, keyEpoch, envelope },
        token,
      );
    assert.equal((await write(viewer.token, 1)).status, 403);
    const first = box();
    assert.equal((await write(editor.token, 1, first)).json.revision, 2);
    assert.equal((await write(owner.token, 1)).status, 409);
    assert.equal((await write(owner.token, 2, box(), 2)).status, 409);
    const writes = await Promise.all([
      write(owner.token, 2),
      write(editor.token, 2),
    ]);
    assert.deepEqual(writes.map((w) => w.status).sort(), [200, 409]);
    const fetched = await call("GET", `/vaults/${id}`, undefined, viewer.token);
    assert.equal(fetched.json.revision, 3);
    assert.equal(fetched.json.role, "viewer");

    // Each member's private part is their own, viewers included.
    const mine = box();
    assert.equal(
      (
        await call(
          "PUT",
          `/vaults/${id}/private`,
          { revision: 0, envelope: mine },
          viewer.token,
        )
      ).json.revision,
      1,
    );
    assert.equal(
      (
        await call(
          "PUT",
          `/vaults/${id}/private`,
          { revision: 0, envelope: box() },
          viewer.token,
        )
      ).status,
      409,
    );
    assert.deepEqual(
      (await call("GET", `/vaults/${id}/private`, undefined, viewer.token)).json
        .envelope,
      mine,
    );
    assert.equal(
      (await call("GET", `/vaults/${id}/private`, undefined, editor.token))
        .json,
      null,
    );

    for (let revision = 3; revision < 3 + HISTORY + 5; revision++)
      assert.equal((await write(owner.token, revision)).status, 200);
    assert.equal(
      (await readdir(join(directory, "history", id))).length,
      HISTORY,
    );

    const api = await restart();
    const after = await api.call(
      "GET",
      `/vaults/${id}`,
      undefined,
      owner.token,
    );
    assert.equal(after.json.revision, 3 + HISTORY + 5);
    assert.deepEqual(
      (await api.call("GET", `/vaults/${id}/private`, undefined, viewer.token))
        .json.envelope,
      mine,
    );
  });
});

test("rotation removes members atomically and needs a key for everyone left", async () => {
  await withServer(async ({ call, register }) => {
    const owner = await register("owner");
    const kept = await register("kept");
    const removed = await register("removed");
    const id = vaultId();
    await call(
      "POST",
      "/vaults",
      { id, meta: box(), sealedKey: sealed(), envelope: box() },
      owner.token,
    );
    for (const user of [kept, removed])
      await call(
        "PUT",
        `/vaults/${id}/members/${user.id}`,
        { role: "editor", keyEpoch: 1, sealedKey: sealed() },
        owner.token,
      );
    await call(
      "PUT",
      `/vaults/${id}/private`,
      { revision: 0, envelope: box() },
      removed.token,
    );

    const rotate = (body: Json, token = owner.token) =>
      call(
        "POST",
        `/vaults/${id}/rotate`,
        {
          revision: 1,
          keyEpoch: 2,
          envelope: box(),
          meta: box(),
          remove: [removed.id],
          ...body,
        },
        token,
      );
    assert.equal(
      (
        await rotate(
          { sealedKeys: { [owner.id]: sealed(), [kept.id]: sealed() } },
          kept.token,
        )
      ).status,
      403,
    );
    assert.equal(
      (await rotate({ sealedKeys: { [owner.id]: sealed() } })).status,
      409,
    );
    assert.equal(
      (
        await rotate({
          sealedKeys: { [owner.id]: sealed(), [kept.id]: sealed() },
          keyEpoch: 3,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await rotate({
          sealedKeys: { [kept.id]: sealed() },
          remove: [removed.id, owner.id],
        })
      ).status,
      409,
    );
    const done = await rotate({
      sealedKeys: { [owner.id]: sealed(), [kept.id]: sealed() },
    });
    assert.deepEqual(done.json, { revision: 2, keyEpoch: 2 });
    assert.equal(
      (await call("GET", `/vaults/${id}`, undefined, removed.token)).status,
      404,
    );
    assert.equal(
      (await call("GET", `/vaults/${id}`, undefined, kept.token)).json.keyEpoch,
      2,
    );
    // Writes made with the old key are refused.
    assert.equal(
      (
        await call(
          "PUT",
          `/vaults/${id}/data`,
          { revision: 2, keyEpoch: 1, envelope: box() },
          kept.token,
        )
      ).status,
      409,
    );

    assert.equal(
      (await call("DELETE", `/vaults/${id}/members/me`, undefined, owner.token))
        .status,
      409,
    );
    assert.equal(
      (await call("DELETE", `/vaults/${id}/members/me`, undefined, kept.token))
        .status,
      200,
    );
    assert.equal(
      (await call("GET", "/vaults", undefined, kept.token)).json.length,
      0,
    );
    assert.equal(
      (await call("DELETE", `/vaults/${id}`, undefined, owner.token)).status,
      200,
    );
    assert.equal(
      (await call("GET", "/vaults", undefined, owner.token)).json.length,
      0,
    );
  });
});

test("requests without a valid session, unknown routes and oversized bodies are refused", async () => {
  await withServer(async ({ base, call, register }) => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await call("GET", "/vaults")).status, 401);
    assert.equal(
      (await call("GET", "/vaults", undefined, "forged")).status,
      401,
    );
    assert.equal((await call("GET", "/nothing")).status, 404);
    const user = await register("mario");
    assert.equal(
      (
        await call(
          "GET",
          "/vaults/%2E%2E%2Fusers%2Fmario",
          undefined,
          user.token,
        )
      ).status,
      404,
    );
    // The server answers 413 and drops the connection without reading the rest, so the upload may be cut first.
    const big = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "x".repeat(70 * 1024) }),
    }).then(
      (r) => r.status,
      () => 413,
    );
    assert.equal(big, 413);
    assert.equal((await call("POST", "/login", "not an object")).status, 400);
  });
});
