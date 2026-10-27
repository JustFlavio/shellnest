import { test } from "node:test";
import assert from "node:assert/strict";
import { timelineSteps } from "./connection-steps.mjs";

const base = {
  kind: "ssh",
  target: "h:22",
  askedTrust: false,
  awaitingTrust: false,
  phase: "Avvio della connessione",
  failure: "",
  opened: false,
};
const states = (o) =>
  timelineSteps({ ...base, ...o }).map((s) => s.id + ":" + s.state);

test("known host skips the fingerprint step", () => {
  assert.deepEqual(states({}), [
    "connect:current",
    "auth:pending",
    "session:pending",
  ]);
  assert.deepEqual(states({ phase: "Autenticazione SSH" }), [
    "connect:done",
    "auth:current",
    "session:pending",
  ]);
});

test("first access waits on the fingerprint step, then moves on", () => {
  assert.deepEqual(states({ askedTrust: true, awaitingTrust: true }), [
    "connect:done",
    "trust:current",
    "auth:pending",
    "session:pending",
  ]);
  assert.deepEqual(
    states({ askedTrust: true, phase: "Impronta del server verificata" }),
    ["connect:done", "trust:done", "auth:current", "session:pending"],
  );
});

test("failure marks the step that was running", () => {
  assert.deepEqual(
    states({ phase: "Autenticazione SSH", failure: "Autenticazione fallita" }),
    ["connect:done", "auth:failed", "session:pending"],
  );
  assert.deepEqual(states({ failure: "timeout" }), [
    "connect:failed",
    "auth:pending",
    "session:pending",
  ]);
});

test("a changed fingerprint fails the fingerprint step even if none was asked", () => {
  assert.deepEqual(
    states({ failure: "Identità del server cambiata. Connessione bloccata" }),
    ["connect:done", "trust:failed", "auth:pending", "session:pending"],
  );
});

test("opened completes every step; local has no network steps", () => {
  assert.ok(states({ opened: true }).every((s) => s.endsWith(":done")));
  assert.deepEqual(states({ kind: "local" }), [
    "connect:current",
    "session:pending",
  ]);
});

test("a password request adds its step after authentication", () => {
  const asking = { phase: "Autenticazione SSH", password: true };
  assert.deepEqual(states(asking), [
    "connect:done",
    "auth:done",
    "password:current",
    "session:pending",
  ]);
  // sent, waiting for the answer: still on that step
  assert.deepEqual(states({ ...asking, password: false }), states(asking));
  assert.deepEqual(states({ ...asking, failure: "Autenticazione fallita" }), [
    "connect:done",
    "auth:done",
    "password:failed",
    "session:pending",
  ]);
  assert.ok(
    states({ ...asking, opened: true }).every((s) => s.endsWith(":done")),
  );
});
