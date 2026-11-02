import { test } from "node:test";
import assert from "node:assert/strict";
import { newGroup, newIdentity, newKey } from "../../lib/types.ts";
import {
  groupFormErrors,
  identityFormErrors,
  keyFormErrors,
} from "./form-checks.ts";

test("an empty identity names every missing field", () => {
  const form = { ...newIdentity(), username: "", auth: "key" as const };
  assert.deepEqual(identityFormErrors(form, false), {
    name: "error.model.IdentityIncomplete",
    username: "error.model.UsernameMissing",
    key: "hosts.hostEditor.chooseAKey",
  });
  const saved = {
    ...form,
    name: "Ops",
    username: "root",
    auth: "password" as const,
  };
  assert.deepEqual(identityFormErrors(saved, true), {});
  assert.deepEqual(identityFormErrors(saved, false), {
    password: "error.model.PasswordRequired",
  });
});

test("a key needs a name, and a private key only when new", () => {
  assert.deepEqual(keyFormErrors(newKey(), false), {
    name: "error.model.KeyNameMissing",
    privateKey: "error.model.KeyImportRequired",
  });
  assert.deepEqual(keyFormErrors({ ...newKey(), name: "Work" }, true), {});
});

test("a folder name is trimmed like the backend does, and the port is checked", () => {
  assert.deepEqual(groupFormErrors({ ...newGroup(""), name: " Web " }), {});
  assert.deepEqual(groupFormErrors({ ...newGroup(""), name: "a/b", port: 0 }), {
    name: "error.model.GroupNameInvalid",
    port: "error.model.PortInvalid",
  });
});
