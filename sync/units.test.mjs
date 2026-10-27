import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthenticator } from "./src/auth.mjs";
import { readConfig } from "./src/config.mjs";
import { isEnvelope } from "./src/envelope.mjs";
import { vaultIdFromPath } from "./src/vault-id.mjs";

const b64 = (n, fill = 1) => Buffer.alloc(n, fill).toString("base64");
const envelope = () => ({
  version: 1,
  salt: b64(16),
  nonce: b64(24),
  ciphertext: b64(48),
});

test("vault ids follow the client rule and cannot escape the data directory", () => {
  assert.equal(vaultIdFromPath("/vault"), "personal");
  assert.equal(vaultIdFromPath("/vaults/personal"), "personal");
  assert.equal(vaultIdFromPath("/vaults/work-2"), "work-2");
  assert.equal(vaultIdFromPath(`/vaults/${"a".repeat(64)}`), `a`.repeat(64));
  for (const path of [
    `/vaults/${"a".repeat(65)}`,
    "/vaults/",
    "/vaults",
    "/vaults/Work",
    "/vaults/a_b",
    "/vaults/con",
    "/vaults/com1",
    "/vaults/lpt9",
    "/vaults/..",
    "/vaults/../vault",
    "/vaults/a/b",
    "/vaults/%2e%2e%2fsecret",
    "/vaults/a%00",
    "/vaults/a.json",
    "/vaults/a?x=1",
    "/vault/",
    "/vault?x=1",
    "//vaults/work",
    "/",
  ])
    assert.equal(vaultIdFromPath(path), null, path);
});

test("envelope accepts only the exact encrypted container shape", () => {
  assert.ok(isEnvelope(envelope()));
  for (const bad of [
    null,
    "text",
    [],
    { ...envelope(), version: 2 },
    { ...envelope(), extra: 1 },
    { ...envelope(), salt: b64(15) },
    { ...envelope(), nonce: b64(16) },
    { ...envelope(), ciphertext: b64(8) },
    { ...envelope(), ciphertext: "not base64!" },
    { ...envelope(), ciphertext: 5 },
    { version: 1, salt: b64(16), nonce: b64(24) },
  ])
    assert.equal(isEnvelope(bad), false, JSON.stringify(bad));
});

test("token must be long enough and is compared against the Bearer header", () => {
  assert.throws(() => createAuthenticator(undefined), /SYNC_TOKEN/);
  assert.throws(() => createAuthenticator("short"), /at least 32/);
  const token = "x".repeat(32);
  const authorized = createAuthenticator(token);
  assert.equal(authorized(`Bearer ${token}`), true);
  assert.equal(authorized(token), false);
  assert.equal(authorized(`bearer ${token}`), false);
  assert.equal(authorized(`Bearer ${token}y`), false);
  assert.equal(authorized(undefined), false);
});

test("config defaults to loopback and rejects a bad port", () => {
  const config = readConfig({});
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 8787);
  assert.match(config.directory, /sync[\\/]data$/);
  const custom = readConfig({
    SYNC_HOST: "0.0.0.0",
    SYNC_PORT: "9000",
    SYNC_DATA_DIR: "/srv/x",
  });
  assert.deepEqual(
    [custom.host, custom.port, custom.directory],
    ["0.0.0.0", 9000, "/srv/x"],
  );
  for (const SYNC_PORT of ["abc", "70000", "-1", "1.5"])
    assert.throws(() => readConfig({ SYNC_PORT }), /SYNC_PORT/);
});
