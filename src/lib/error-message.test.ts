import assert from "node:assert/strict";
import { test } from "node:test";
import { i18n } from "../i18n/i18n.ts";
import { describeError, errorToastId } from "./error-message.ts";

test("describeError unwraps Error objects and plain strings", () => {
  assert.equal(describeError(new Error("network down")), "network down");
  assert.equal(describeError("network down"), "network down");
  assert.equal(describeError("Error: network down "), "network down");
  assert.equal(describeError(new TypeError("x")), "x");
});

test("errorToastId is stable per title and detail", () => {
  assert.equal(errorToastId("Sync", "a"), errorToastId("Sync", "a"));
  assert.notEqual(errorToastId("Sync", "a"), errorToastId("Sync", "b"));
  assert.notEqual(errorToastId("Sync", "a"), errorToastId("Copia", "a"));
});

test("describeError translates a coded message in the active language", async () => {
  await i18n.changeLanguage("en");
  assert.equal(describeError({ code: "model.HostNotFound" }), "Host not found");
  assert.equal(
    describeError({ code: "model.GroupNameTaken", params: "web" }),
    "A folder named web already exists",
  );
  await i18n.changeLanguage("it");
  assert.equal(
    describeError({ code: "model.HostNotFound" }),
    "Host non trovato",
  );
  await i18n.changeLanguage("en");
});

test("a number picks the plural form", async () => {
  await i18n.changeLanguage("en");
  assert.match(
    describeError({ code: "model.KeyInUse", params: 1 }),
    /1 identity\./,
  );
  assert.match(
    describeError({ code: "model.KeyInUse", params: 3 }),
    /3 identities\./,
  );
});

test("the refusal sentence follows its context", async () => {
  await i18n.changeLanguage("en");
  const refused = (params: object) =>
    describeError({ code: "terminal.AuthRefused", params });
  assert.equal(
    refused({ methods: "", context: "none" }),
    "Authentication failed",
  );
  assert.equal(
    refused({ methods: "password" }),
    "Authentication failed. Methods accepted by the server: password.",
  );
  assert.match(
    refused({ methods: "gssapi", context: "unsupported" }),
    /only supports key and password/,
  );
});

test("an unknown code falls back to the code itself", () => {
  assert.equal(describeError({ code: "model.Nope" }), "model.Nope");
});
