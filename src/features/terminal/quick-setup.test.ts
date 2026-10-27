import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canSave,
  emptySetup,
  identityForKey,
  needsMethod,
  pickableIdentities,
  quickLogin,
} from "./quick-setup.ts";

const identity = (o: object) => ({
  id: "i",
  name: "Deploy",
  username: "deploy",
  auth: "key" as const,
  keyId: "k",
  hasPassword: false,
  hostCount: 0,
  ...o,
});

test("the user defaults from the typed address and must be valid", () => {
  assert.equal(emptySetup("1.2.3.4", "root").username, "root");
  assert.equal(emptySetup("1.2.3.4").name, "1.2.3.4");
  assert.equal(quickLogin(emptySetup("h")), null);
  assert.equal(quickLogin(emptySetup("h", "bad user")), null);
  assert.deepEqual(quickLogin(emptySetup("h", "root")), { kind: "password" });
});

test("an identity replaces the second question", () => {
  const setup = { ...emptySetup("h", "root"), identityId: "i" };
  assert.equal(needsMethod(setup), false);
  assert.deepEqual(quickLogin(setup), { kind: "identity", id: "i" });
  assert.equal(needsMethod(emptySetup("h", "root")), true);
});

test("a key login needs a key", () => {
  const setup = { ...emptySetup("h", "root"), method: "key" as const };
  assert.equal(quickLogin(setup), null);
  assert.deepEqual(quickLogin({ ...setup, keyId: "k" }), {
    kind: "key",
    id: "k",
  });
});

test("saving needs a name, and a typed password when logging in by password", () => {
  const base = emptySetup("h", "root");
  assert.equal(canSave(base), false);
  assert.equal(canSave({ ...base, password: "x" }), true);
  assert.equal(canSave({ ...base, password: "x", name: " " }), false);
  assert.equal(canSave({ ...base, method: "key", keyId: "k" }), true);
  assert.equal(canSave({ ...base, identityId: "i" }), true);
});

test("only identities that can log in on their own are offered, filtered by the search", () => {
  const list = [
    identity({}),
    identity({
      id: "p",
      name: "Web",
      username: "www",
      auth: "password",
      keyId: "",
      hasPassword: true,
    }),
    identity({
      id: "x",
      name: "Senza",
      auth: "password",
      keyId: "",
      hasPassword: false,
    }),
    identity({ id: "y", name: "Senza chiave", keyId: "" }),
  ];
  assert.deepEqual(
    pickableIdentities(list, "").map((i) => i.id),
    ["i", "p"],
  );
  assert.deepEqual(
    pickableIdentities(list, " WWW").map((i) => i.id),
    ["p"],
  );
  assert.deepEqual(
    pickableIdentities(list, "deploy").map((i) => i.id),
    ["i"],
  );
});

test("a key login is saved under an existing identity, or a new one with a free name", () => {
  const list = [identity({})];
  assert.deepEqual(identityForKey(list, "deploy", "k", "Personale"), {
    id: "i",
    isNew: false,
    name: "Deploy",
  });
  const fresh = identityForKey(list, "root", "k", "Personale");
  assert.equal(fresh.isNew, true);
  assert.equal(fresh.name, "root · Personale");
  const taken = [
    identity({ id: "z", name: "root · Personale", username: "other" }),
  ];
  assert.equal(
    identityForKey(taken, "root", "k", "Personale").name,
    "root · Personale (2)",
  );
});
