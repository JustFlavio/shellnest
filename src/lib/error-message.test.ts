import assert from "node:assert/strict";
import { test } from "node:test";
import { describeError, errorToastId } from "./error-message.ts";

test("describeError unwraps Error objects and plain strings", () => {
  assert.equal(describeError(new Error("rete assente")), "rete assente");
  assert.equal(describeError("rete assente"), "rete assente");
  assert.equal(describeError("Error: rete assente "), "rete assente");
  assert.equal(describeError(new TypeError("x")), "x");
});

test("errorToastId is stable per title and detail", () => {
  assert.equal(errorToastId("Sync", "a"), errorToastId("Sync", "a"));
  assert.notEqual(errorToastId("Sync", "a"), errorToastId("Sync", "b"));
  assert.notEqual(errorToastId("Sync", "a"), errorToastId("Copia", "a"));
});
