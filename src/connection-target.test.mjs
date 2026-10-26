import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConnectionTarget } from "./connection-target.mjs";

test("SSH destinations, optional usernames and ports are parsed as structured data", () => {
  for (const text of [
    "deploy@example.com:2222",
    "ssh deploy@example.com -p 2222",
    "ssh -p 2222 deploy@example.com",
  ]) {
    assert.deepEqual(parseConnectionTarget(text), {
      address: "example.com",
      port: 2222,
      username: "deploy",
    });
  }
  assert.deepEqual(parseConnectionTarget("  ssh root@localhost  "), {
    address: "localhost",
    port: 22,
    username: "root",
  });
  assert.deepEqual(parseConnectionTarget("192.0.2.12"), {
    address: "192.0.2.12",
    port: 22,
  });
  assert.deepEqual(parseConnectionTarget("root@[2001:db8::1]:2222"), {
    address: "2001:db8::1",
    port: 2222,
    username: "root",
  });
  assert.deepEqual(parseConnectionTarget("ssh [::1] -p 22"), {
    address: "::1",
    port: 22,
  });
});

test("Commands, credentials, invalid ports and malformed addresses are rejected", () => {
  for (const text of [
    "",
    "ssh",
    "ssh ",
    "ssh -L 8080:localhost:80 root@host",
    "ssh root@host whoami",
    "root:password@host",
    "root@@host",
    "host:0",
    "host:65536",
    "host:abc",
    "host:-22",
    "ssh host:22 -p 23",
    "ssh -p 22.5 host",
    "host;whoami",
    "host&&whoami",
    "$(whoami)",
    "host\nwhoami",
    "host\t",
    "-host",
    "host-",
    "host..com",
    "300.1.2.3",
    "2001:db8::1",
    "[invalid]",
    "[1:2:3]:22",
    "[::1]:",
    "https://host",
    "host/path",
    null,
    12,
  ]) {
    assert.equal(parseConnectionTarget(text), null, String(text));
  }
});
