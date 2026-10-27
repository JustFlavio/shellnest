import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import net from "node:net";
import { createSyncServer } from "./server.mjs";

const token = "test-only-token-with-at-least-32-characters";
const env = (n) => ({
  version: 1,
  salt: Buffer.alloc(16, 1).toString("base64"),
  nonce: Buffer.alloc(24, n).toString("base64"),
  ciphertext: Buffer.alloc(48, n).toString("base64"),
});

test("vault namespaces preserve legacy storage and isolate conditional writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shellnest-vaults-"));
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
  const directory = await mkdtemp(join(tmpdir(), "shellnest-"));
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

// What the desktop client relies on (src-tauri/src/sync.rs).
async function withServer(fn) {
  const directory = await mkdtemp(join(tmpdir(), "shellnest-"));
  const server = await createSyncServer({ token, directory });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (
    path,
    { method = "GET", body, headers = {}, auth = true } = {},
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth && { Authorization: `Bearer ${token}` }),
        "Content-Type": "application/json",
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    });
  try {
    await fn({ request, directory, base });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await rm(directory, { recursive: true, force: true });
  }
}

// fetch normalizes paths and sets Content-Length itself; a raw socket sends exactly what we want.
const rawRequest = (base, head, body = "") =>
  new Promise((resolve) => {
    const socket = net.connect(new URL(base).port, "127.0.0.1", () =>
      socket.write(`${head}\r\nHost: x\r\nConnection: close\r\n\r\n${body}`),
    );
    let data = "";
    socket.on("data", (d) => (data += d));
    socket.on("error", () => {});
    socket.on("close", () => resolve(data));
  });
const auth = `Authorization: Bearer ${token}`;

test("/health needs no token and reveals nothing", () =>
  withServer(async ({ request }) => {
    const res = await request("/health", { auth: false });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(
      (await request("/health", { method: "PUT", auth: false })).status,
      401,
    );
  }));

test("wrong or missing token is 401 on every vault route", () =>
  withServer(async ({ request }) => {
    for (const path of ["/vault", "/vaults/personal", "/vaults/work"]) {
      assert.equal((await request(path, { auth: false })).status, 401);
      assert.equal(
        (
          await request(path, {
            headers: { Authorization: `Bearer ${token}x` },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request(path, {
            method: "PUT",
            body: env(1),
            auth: false,
            headers: { "If-None-Match": "*" },
          })
        ).status,
        401,
      );
    }
  }));

test("create-if-absent: If-None-Match * works once, then conflicts", () =>
  withServer(async ({ request }) => {
    const put = (n, headers) =>
      request("/vaults/work", { method: "PUT", body: env(n), headers });
    assert.equal((await put(1, {})).status, 412);
    assert.equal((await put(1, { "If-None-Match": "*" })).status, 200);
    assert.equal((await put(2, { "If-None-Match": "*" })).status, 412);
    assert.deepEqual(await (await request("/vaults/work")).json(), env(1));
  }));

test("a stale ETag is refused and leaves the stored vault untouched", () =>
  withServer(async ({ request, directory }) => {
    const put = (n, headers) =>
      request("/vault", { method: "PUT", body: env(n), headers });
    const first = (await put(1, { "If-None-Match": "*" })).headers.get("etag");
    const second = (await put(2, { "If-Match": first })).headers.get("etag");
    assert.notEqual(first, second);
    assert.equal((await put(3, { "If-Match": first })).status, 412);
    assert.equal((await put(3, {})).status, 412);
    const current = await request("/vault");
    assert.equal(current.headers.get("etag"), second);
    assert.deepEqual(await current.json(), env(2));
    // The version before the last write is kept next to it.
    const previous = JSON.parse(
      await readFile(join(directory, "vault.previous.json")),
    );
    assert.deepEqual(previous, env(1));
  }));

test("the ETag of a PUT matches the ETag of the next GET", () =>
  withServer(async ({ request }) => {
    const put = await request("/vaults/work", {
      method: "PUT",
      body: env(1),
      headers: { "If-None-Match": "*" },
    });
    assert.equal(
      put.headers.get("etag"),
      (await request("/vaults/work")).headers.get("etag"),
    );
  }));

test("bodies over 8 MiB are refused, declared or streamed", () =>
  withServer(async ({ request, base }) => {
    const declared = await rawRequest(
      base,
      `PUT /vaults/work HTTP/1.1\r\n${auth}\r\nIf-None-Match: *\r\nContent-Length: ${9 * 1024 * 1024}`,
      "{",
    );
    assert.match(declared, /^HTTP\/1.1 413/);
    // Chunked, so no Content-Length: the limit applies to the bytes actually received.
    const big = JSON.stringify({
      ...env(1),
      ciphertext: "A".repeat(9 * 1024 * 1024),
    });
    const streamed = await fetch(`${base}/vaults/work`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "If-None-Match": "*" },
      body: new Blob([big]).stream(),
      duplex: "half",
    }).then(
      (r) => r.status,
      () => "connection closed",
    );
    // The server drops the connection once it answers, so the client may see either.
    assert.ok([413, "connection closed"].includes(streamed), String(streamed));
    assert.equal((await request("/vaults/work")).status, 404);
  }));

test("malformed, plaintext and extra-field uploads are 400", () =>
  withServer(async ({ request }) => {
    const headers = { "If-None-Match": "*" };
    for (const body of [
      "{nope",
      "[]",
      JSON.stringify({ ...env(1), host: "x" }),
      JSON.stringify({ hosts: [] }),
    ])
      assert.equal(
        (await request("/vault", { method: "PUT", body, headers })).status,
        400,
        body,
      );
    assert.equal((await request("/vault")).status, 404);
  }));

test("invalid ids and traversal attempts never reach the disk", () =>
  withServer(async ({ request, base, directory }) => {
    const headers = { "If-None-Match": "*" };
    for (const path of [
      "/vaults/Bad-ID",
      "/vaults/con",
      "/vaults/%2e%2e",
      "/vaults/%2e%2e%2fvault",
      "/vaults/a%2fb",
      "/vaults/a.json",
      `/vaults/${"a".repeat(65)}`,
      "/vaults/",
      "/other",
      "/vault/extra",
      "/vault?x=1",
    ]) {
      assert.equal((await request(path)).status, 404, path);
      assert.equal(
        (await request(path, { method: "PUT", body: env(1), headers })).status,
        404,
        path,
      );
    }
    for (const path of [
      "/vaults/..",
      "/vaults/../vault",
      "/vaults/../../etc/passwd",
      "/vaults/./work",
      "/vaults//work",
    ])
      for (const method of ["GET", "PUT"])
        assert.match(
          await rawRequest(
            base,
            `${method} ${path} HTTP/1.1\r\n${auth}\r\nIf-None-Match: *\r\nContent-Length: 0`,
          ),
          /^HTTP\/1.1 404/,
          path,
        );
    assert.deepEqual(await readdir(join(directory, "vaults")), []);
    assert.equal((await readdir(directory)).includes("vault.json"), false);
  }));

test("only GET and PUT are allowed on a vault", () =>
  withServer(async ({ request }) => {
    for (const method of ["POST", "DELETE", "PATCH"]) {
      const res = await request("/vault", { method, body: env(1) });
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("allow"), "GET, PUT");
    }
  }));

test("stored files are private and nothing but the envelope is on disk", () =>
  withServer(async ({ request, directory }) => {
    await request("/vaults/work", {
      method: "PUT",
      body: env(1),
      headers: { "If-None-Match": "*" },
    });
    const file = join(directory, "vaults", "work.json");
    if (process.platform !== "win32")
      assert.equal((await stat(file)).mode & 0o777, 0o600);
    const text = await readFile(file, "utf8");
    assert.equal(text.includes(token), false);
    assert.deepEqual(await readdir(join(directory, "vaults")), ["work.json"]);
  }));

test("a corrupt stored file gives 500 and reports the error without its content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shellnest-"));
  const errors = [];
  const server = await createSyncServer({
    token,
    directory,
    onError: (e) => errors.push(e),
  });
  try {
    await writeFile(join(directory, "vault.json"), "secret-looking garbage");
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const res = await fetch(`http://127.0.0.1:${server.address().port}/vault`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "Storage unavailable" });
    assert.equal(errors.length, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await rm(directory, { recursive: true, force: true });
  }
});

test("the server refuses to be created with a short token", async () => {
  await assert.rejects(
    createSyncServer({ token: "short", directory: tmpdir() }),
    /SYNC_TOKEN/,
  );
});
