import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createLimiter, makeVerifier, verify } from "./src/auth.ts";
import type { IncomingMessage } from "node:http";
import { clientAddress } from "./src/app.ts";
import { readConfig } from "./src/config.ts";
import {
  isBase64,
  isBox,
  isId,
  isSalt,
  isSealed,
  isUsername,
} from "./src/shapes.ts";

const b64 = (n: number, fill = 1) => Buffer.alloc(n, fill).toString("base64");

test("boxes and sealed keys accept only the exact encrypted shapes", () => {
  assert.ok(isBox({ nonce: b64(24), ciphertext: b64(48) }));
  for (const bad of [
    null,
    "text",
    [],
    { nonce: b64(24) },
    { nonce: b64(23), ciphertext: b64(48) },
    { nonce: b64(24), ciphertext: b64(15) },
    { nonce: b64(24), ciphertext: b64(48), extra: 1 },
    { nonce: b64(24), ciphertext: "not base64!" },
    { nonce: b64(24), ciphertext: `${b64(48)}\n` },
  ])
    assert.equal(isBox(bad), false, JSON.stringify(bad));
  assert.ok(
    isSealed({ ephemeral: b64(32), nonce: b64(24), ciphertext: b64(48) }),
  );
  assert.equal(
    isSealed({ ephemeral: b64(32), nonce: b64(24), ciphertext: b64(64) }),
    false,
  );
  assert.equal(isBase64("QQ"), false, "non-canonical padding");
});

test("salts carry the KDF version in front of 16 bytes", () => {
  const bytes = Buffer.alloc(16, 7).toString("base64");
  assert.equal(isSalt(`1:${bytes}`), true);
  assert.equal(isSalt(`12:${bytes}`), true);
  assert.equal(isSalt(bytes), false, "no version");
  assert.equal(isSalt(`0:${bytes}`), false);
  assert.equal(isSalt(`1:${bytes}:x`), false);
  assert.equal(isSalt(`1:${Buffer.alloc(15).toString("base64")}`), false);
});

test("usernames and ids cannot carry path separators or odd characters", () => {
  for (const ok of ["mario", "m.rossi", "ops-team_2", "a1"])
    assert.ok(isUsername(ok), ok);
  for (const bad of [
    "a",
    "Mario",
    "../x",
    "a/b",
    ".hidden",
    "x".repeat(33),
    "mario rossi",
  ])
    assert.equal(isUsername(bad), false, bad);
  assert.ok(isId("0123456789abcdef0123456789abcdef"));
  assert.equal(isId("../../etc/passwd"), false);
  assert.equal(isId("0123456789ABCDEF0123456789ABCDEF"), false);
});

test("verifiers check the secret without storing it", async () => {
  const secret = Buffer.alloc(32, 7);
  const verifier = await makeVerifier(secret);
  assert.equal(
    JSON.stringify(verifier).includes(secret.toString("base64")),
    false,
  );
  assert.ok(await verify(secret, verifier));
  assert.equal(await verify(Buffer.alloc(32, 8), verifier), false);
});

test("the limiter blocks after repeated failures and forgets them in time", () => {
  let now = 0;
  const limiter = createLimiter({
    attempts: 3,
    windowMs: 1000,
    now: () => now,
  });
  for (let i = 0; i < 3; i++) limiter.fail("mario");
  assert.ok(limiter.blocked("mario"));
  assert.equal(limiter.blocked("anna"), false);
  now = 1001;
  assert.equal(limiter.blocked("mario"), false);
  limiter.fail("mario");
  limiter.clear("mario");
  assert.equal(limiter.blocked("mario"), false);
});

test("the limiter keeps recent failures when it drops stale keys", () => {
  let now = 0;
  const limiter = createLimiter({
    attempts: 3,
    windowMs: 1000,
    now: () => now,
  });
  for (let i = 0; i < 10_000; i++) limiter.fail(`stale ${i}`);
  now = 600;
  limiter.fail("mario");
  limiter.fail("mario");
  now = 1200;
  // The map is over the threshold: this failure sweeps the stale keys.
  limiter.fail("anna");
  limiter.fail("mario");
  assert.ok(limiter.blocked("mario"));
  assert.equal(limiter.blocked("anna"), false);
  assert.equal(limiter.blocked("stale 0"), false);
});

test("config defaults to loopback and validates the port", () => {
  assert.deepEqual(readConfig({}), {
    host: "127.0.0.1",
    port: 8787,
    directory: resolve("sync/data"),
    trustProxy: false,
  });
  assert.equal(readConfig({ SYNC_TRUST_PROXY: "1" }).trustProxy, true);
  assert.throws(() => readConfig({ SYNC_PORT: "70000" }));
  assert.throws(() => readConfig({ SYNC_PORT: "abc" }));
});

test("the client address comes from the proxy only when it is trusted", () => {
  const req = (forwarded?: string | string[]) =>
    ({
      headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
      socket: { remoteAddress: "172.18.0.3" },
    }) as unknown as IncomingMessage;
  assert.equal(clientAddress(req("203.0.113.9"), false), "172.18.0.3");
  assert.equal(clientAddress(req("203.0.113.9"), true), "203.0.113.9");
  // A client can send its own header; the proxy appends the real address last.
  assert.equal(
    clientAddress(req("198.51.100.1, 203.0.113.9"), true),
    "203.0.113.9",
  );
  assert.equal(
    clientAddress(req(["198.51.100.1", "203.0.113.9"]), true),
    "203.0.113.9",
  );
  assert.equal(clientAddress(req(), true), "172.18.0.3");
});
