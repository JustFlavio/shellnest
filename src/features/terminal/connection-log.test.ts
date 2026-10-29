import { test } from "node:test";
import assert from "node:assert/strict";
import { i18n } from "../../i18n/i18n.ts";
import {
  atBottom,
  formatOffset,
  logKind,
  logSegments,
  logText,
} from "./connection-log.ts";

await i18n.changeLanguage("en");

test("the kind is part of the code; other codes are errors", () => {
  const kinds: [string, string][] = [
    ["log.network.resolving", "network"],
    ["log.network.server", "network"],
    ["log.tech.algorithms", "tech"],
    ["log.fingerprint.known", "fingerprint"],
    ["log.auth.keyAttempt", "auth"],
    ["log.auth.passwordAttempt", "auth"],
    ["log.error.keyRefused", "error"],
    ["log.error.fingerprintChanged", "error"],
    ["log.success.passwordOk", "success"],
    ["log.success.keyAccepted", "success"],
    ["terminal.PasswordsExhausted", "error"],
    ["terminal.ConnectTimeout", "error"],
  ];
  for (const [code, kind] of kinds) assert.equal(logKind({ code }), kind, code);
});

test("offsets in seconds, then in minutes", () => {
  assert.equal(formatOffset(0), "+0.0 s");
  assert.equal(formatOffset(340), "+0.3 s");
  assert.equal(formatOffset(12_340), "+12.3 s");
  assert.equal(formatOffset(125_000), "+2 min 05 s");
  assert.equal(formatOffset(-5), "+0.0 s");
});

test("the offset follows the language", async () => {
  await i18n.changeLanguage("it");
  assert.equal(formatOffset(340), "+0,3 s");
  await i18n.changeLanguage("en");
});

test("the copied text is one plain line per event, with the offset", () => {
  assert.equal(
    logText([
      {
        message: { code: "log.network.resolving", params: { target: "h:22" } },
        at: 0,
      },
      { message: { code: "terminal.ConnectTimeout" }, at: 1500 },
    ]),
    "+0.0 s  Resolving h:22\n+1.5 s  SSH connection timed out",
  );
});

test("values are emphasised, technical lines and errors are not", () => {
  const joined = (code: string, params: object = {}) =>
    logSegments({ code, params })
      .map((s) => (s.strong ? `[${s.text}]` : s.text))
      .join("");
  assert.equal(
    joined("log.network.resolving", { target: "h.example:22" }),
    "Resolving [h.example:22]",
  );
  assert.equal(
    joined("log.auth.savedPasswordAttempt", { user: "root" }),
    "Authenticating with [saved password] for user [root]",
  );
  assert.equal(
    joined("log.tech.algorithms", { kex: "a", hostKey: "b", cipher: "c" }),
    "Negotiated algorithms: key exchange a, host key b, cipher c",
  );
  assert.equal(
    joined("log.error.resolveFailed", { reason: "Fingerprint: x" }),
    "Resolution failed: Fingerprint: x",
  );
  assert.equal(joined("log.network.connected"), "Connection established");
});

test("stays pinned only near the end", () => {
  assert.ok(atBottom(800, 200, 1000));
  assert.ok(atBottom(790, 200, 1000));
  assert.ok(!atBottom(500, 200, 1000));
});
