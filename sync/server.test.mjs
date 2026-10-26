import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createSyncServer } from "./server.mjs";

const token = "test-only-token-with-at-least-32-characters";
const env = (n) => ({
  version: 1,
  salt: Buffer.alloc(16, 1).toString("base64"),
  nonce: Buffer.alloc(24, n).toString("base64"),
  ciphertext: Buffer.alloc(48, n).toString("base64"),
});

test("vault namespaces preserve legacy storage and isolate conditional writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "server-manager-vaults-"));
  let server;
  try {
    server = await createSyncServer({ token, directory });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, method = "GET", body, headers = {}) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const legacy = await request("/vault", "PUT", env(1), {
      "If-None-Match": "*",
    });
    assert.equal(legacy.status, 200);
    const work = await request("/vaults/work", "PUT", env(2), {
      "If-None-Match": "*",
    });
    assert.equal(work.status, 200);
    assert.deepEqual(await (await request("/vault")).json(), env(1));
    assert.deepEqual(await (await request("/vaults/work")).json(), env(2));
    assert.deepEqual(await (await request("/vaults/personal")).json(), env(1));
    assert.equal((await request("/vaults/other")).status, 404);
    assert.equal(
      (
        await request("/vaults/work", "PUT", env(3), {
          "If-Match": legacy.headers.get("etag"),
        })
      ).status,
      412,
    );
    assert.equal(
      (
        await request("/vaults/work", "PUT", env(3), {
          "If-Match": work.headers.get("etag"),
        })
      ).status,
      200,
    );
    assert.deepEqual(await (await request("/vault")).json(), env(1));
    assert.equal((await request("/vaults/Bad-ID")).status, 404);
    assert.equal((await request("/vaults/con")).status, 404);
    assert.equal((await request("/vaults/%2E%2E%2Fsecret")).status, 404);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(directory, { recursive: true, force: true });
  }
});
test("auth, opaque storage, revision conflicts, concurrent writes, restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "server-manager-"));
  let server;
  try {
    const start = async () => {
      server = await createSyncServer({ token, directory });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      return `http://127.0.0.1:${server.address().port}/vault`;
    };
    let url = await start();
    const request = (method = "GET", value, headers = {}) =>
      fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: value ? JSON.stringify(value) : undefined,
      });
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await request()).status, 404);
    assert.equal((await request("PUT", env(1))).status, 412);
    assert.equal(
      (
        await request(
          "PUT",
          { password: "plaintext" },
          { "If-None-Match": "*" },
        )
      ).status,
      400,
    );
    const created = await request("PUT", env(1), { "If-None-Match": "*" });
    assert.equal(created.status, 200);
    const first = created.headers.get("etag");
    assert.ok(first);
    const downloaded = await request();
    assert.deepEqual(await downloaded.json(), env(1));
    const writes = await Promise.all([
      request("PUT", env(2), { "If-Match": first }),
      request("PUT", env(3), { "If-Match": first }),
    ]);
    assert.deepEqual(writes.map((r) => r.status).sort(), [200, 412]);
    const current = await request();
    const expected = await current.json();
    assert.notEqual(current.headers.get("etag"), first);
    await new Promise((r) => server.close(r));
    url = await start();
    assert.deepEqual(await (await request()).json(), expected);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(directory, { recursive: true, force: true });
  }
});
