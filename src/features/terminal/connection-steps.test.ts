import { test } from "node:test";
import assert from "node:assert/strict";
import { timelineSteps } from "./connection-steps.ts";

const base = {
  kind: "ssh" as const,
  target: "h:22",
  askedTrust: false,
  awaitingTrust: false,
  phase: "Avvio della connessione",
  failure: "",
  opened: false,
};
const states = (o: Partial<Parameters<typeof timelineSteps>[0]>) =>
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
  const asking = { phase: "Autenticazione SSH", passwords: 1 };
  assert.deepEqual(states(asking), [
    "connect:done",
    "auth:done",
    "password:current",
    "session:pending",
  ]);
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

test("each refused password adds one more step", () => {
  const asking = { phase: "Autenticazione SSH", passwords: 3 };
  assert.deepEqual(states(asking), [
    "connect:done",
    "auth:done",
    "password:done",
    "password-2:done",
    "password-3:current",
    "session:pending",
  ]);
  assert.equal(
    timelineSteps({ ...base, ...asking })[3].label,
    "Password (tentativo 2)",
  );
  assert.deepEqual(
    states({ ...asking, failure: "Password non accettata dopo 3 tentativi." }),
    [
      "connect:done",
      "auth:done",
      "password:done",
      "password-2:done",
      "password-3:failed",
      "session:pending",
    ],
  );
});

test("a fallback ends in a warning, not a success", () => {
  const details = {
    auth: { text: "Chiave rifiutata dal server", warn: true },
    password: { text: "Password accettata", warn: false },
  };
  const steps = timelineSteps({
    ...base,
    phase: "Apertura del terminale remoto",
    passwords: 1,
    details,
  });
  assert.deepEqual(
    steps.map((s) => s.id + ":" + s.state + ":" + (s.detail ?? "")),
    [
      "connect:done:host già noto, impronta coincide",
      "auth:warning:Chiave rifiutata dal server",
      "password:done:Password accettata",
      "session:current:",
    ],
  );
});

test("details: server banner, known host, new fingerprint, key name", () => {
  const detail = (
    o: Partial<Parameters<typeof timelineSteps>[0]>,
    id: string,
  ) => timelineSteps({ ...base, ...o }).find((s) => s.id === id)?.detail;
  const done = { phase: "Apertura del terminale remoto" };
  const banner = { connect: { text: "SSH-2.0-OpenSSH_9.6", warn: false } };
  assert.equal(
    detail({ ...done, details: banner }, "connect"),
    "SSH-2.0-OpenSSH_9.6 · host già noto, impronta coincide",
  );
  assert.equal(
    detail({ ...done, askedTrust: true, details: banner }, "connect"),
    "SSH-2.0-OpenSSH_9.6",
  );
  assert.equal(
    detail({ ...done, askedTrust: true }, "trust"),
    "Nuova impronta confermata",
  );
  const key = { auth: { text: "Autenticato con la chiave “k”", warn: false } };
  assert.equal(
    detail({ ...done, details: key }, "auth"),
    "Autenticato con la chiave “k”",
  );
  // nothing is claimed for a step that is still running or failed
  assert.equal(detail({ details: key }, "auth"), undefined);
});

test("a quick connection asks user, then the login, before connecting", () => {
  const quick = { ...base, kind: "quick" as const, askedTrust: true };
  const asking = (setup: Parameters<typeof timelineSteps>[0]["setup"]) =>
    timelineSteps({ ...quick, setup }).map((s) => s.id + ":" + s.state);
  assert.deepEqual(asking({ stage: "user", method: true }), [
    "user:current",
    "method:pending",
    "connect:pending",
    "trust:pending",
    "auth:pending",
    "session:pending",
  ]);
  assert.deepEqual(asking({ stage: "method", method: true }).slice(0, 3), [
    "user:done",
    "method:current",
    "connect:pending",
  ]);
  // an identity answers both: no second question
  assert.deepEqual(asking({ stage: "user", method: false }).slice(0, 2), [
    "user:current",
    "connect:pending",
  ]);
  // answered: the usual steps, the fingerprint one first
  assert.deepEqual(
    timelineSteps({
      ...quick,
      awaitingTrust: true,
      setup: { stage: null, method: true },
    }).map((s) => s.id + ":" + s.state),
    [
      "user:done",
      "method:done",
      "connect:done",
      "trust:current",
      "auth:pending",
      "session:pending",
    ],
  );
});
