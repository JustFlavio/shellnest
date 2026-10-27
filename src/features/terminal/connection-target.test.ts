import { test } from "node:test";
import assert from "node:assert/strict";
import {
  looksLikeTarget,
  parseConnectionTarget,
  quickConnectTarget,
} from "./connection-target.ts";

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

test("only text that is plainly a target looks like one", () => {
  for (const text of [
    "root@rc",
    "rc:22",
    "10.0.0.5",
    "10.0.0.5:2222",
    "[::1]",
    "rc.example.com",
    "ssh rc",
  ])
    assert.ok(looksLikeTarget(text), text);
  for (const text of ["rc", "web-01", "", "  ", "two words", "rc."])
    assert.ok(!looksLikeTarget(text), text);
});

test("the quick-connect target hides for a saved host's exact name or address", () => {
  const hosts = [{ name: "RC-APP-01", address: "46.224.27.223" }];
  assert.equal(quickConnectTarget("rc", hosts), null);
  assert.equal(quickConnectTarget("46.224.27.223", hosts), null);
  assert.equal(quickConnectTarget("rc-app-01", hosts, true), null);
  assert.equal(quickConnectTarget("46.224.27.224", hosts)?.port, 22);
  assert.equal(quickConnectTarget("root@1.2.3.4", hosts)?.username, "root");
});

test("forcing shows the card for a bare word, but never for text that does not parse", () => {
  assert.equal(quickConnectTarget("rc", [], true)?.address, "rc");
  assert.equal(quickConnectTarget("two words", [], true), null);
  assert.equal(quickConnectTarget("  ", [], true), null);
});
