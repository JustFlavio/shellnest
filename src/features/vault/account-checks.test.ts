import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountChecks,
  emptyAccountDraft,
  passwordChecks,
  serverAllowed,
} from "./account-checks.ts";

const valid = {
  ...emptyAccountDraft,
  server: "https://sync.example.com",
  username: "mario",
  password: "a long enough password",
  confirm: "a long enough password",
  invite: "invite-code",
  recoveryKey: "ABCDEFG-HJKLMNP-QRSTUVW-XYZ2345-6789ABC-DEFGHJK-LMNPQRS-TUV",
};

test("the server must be HTTPS, or HTTP on this machine", () => {
  assert.ok(serverAllowed("https://sync.example.com"));
  assert.ok(serverAllowed("https://example.com/shellnest"));
  assert.ok(serverAllowed("http://localhost:8787"));
  assert.ok(serverAllowed("http://127.0.0.1:8787"));
  for (const bad of [
    "",
    "sync.example.com",
    "http://sync.example.com",
    "https://user:pass@sync.example.com",
    "https://sync.example.com/?token=1",
    "ftp://sync.example.com",
  ])
    assert.equal(serverAllowed(bad), false, bad);
});

test("each mode asks only for its own fields", () => {
  for (const mode of ["signIn", "register", "recover"] as const)
    assert.deepEqual(accountChecks(mode, valid), {}, mode);
  assert.deepEqual(accountChecks("signIn", { ...valid, password: "x" }), {});
  assert.deepEqual(
    Object.keys(accountChecks("signIn", emptyAccountDraft)).sort(),
    ["password", "server", "username"],
  );
  assert.deepEqual(
    Object.keys(accountChecks("register", emptyAccountDraft)).sort(),
    ["invite", "password", "server", "username"],
  );
  assert.equal(
    accountChecks("recover", { ...valid, recoveryKey: "too-short" })
      .recoveryKey,
    "vault.accountForm.recoveryInvalid",
  );
  assert.equal(
    accountChecks("register", { ...valid, confirm: "different" }).confirm,
    "vault.useUnlock.thePasswordsDoNot",
  );
  assert.equal(
    accountChecks("register", { ...valid, username: "Mario Rossi" }).username,
    "vault.accountForm.usernameInvalid",
  );
});

test("a new password needs the current one and a confirmation", () => {
  assert.deepEqual(
    passwordChecks({
      current: "old",
      password: valid.password,
      confirm: valid.password,
    }),
    {},
  );
  assert.deepEqual(
    Object.keys(
      passwordChecks({ current: "", password: "short", confirm: "" }),
    ).sort(),
    ["current", "password"],
  );
});
