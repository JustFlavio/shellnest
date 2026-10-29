import { test } from "node:test";
import assert from "node:assert/strict";
import { i18n } from "../../i18n/i18n.ts";
import { targetLabel, timelineSteps } from "./connection-steps.ts";

await i18n.changeLanguage("en");

const base = {
  kind: "ssh" as const,
  target: "h:22",
  askedTrust: false,
  awaitingTrust: false,
  phase: "starting",
  failure: null,
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
  assert.deepEqual(states({ phase: "auth" }), [
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
  assert.deepEqual(states({ askedTrust: true, phase: "verified" }), [
    "connect:done",
    "trust:done",
    "auth:current",
    "session:pending",
  ]);
});

test("failure marks the step that was running", () => {
  assert.deepEqual(
    states({ phase: "auth", failure: { code: "terminal.AuthRefused" } }),
    ["connect:done", "auth:failed", "session:pending"],
  );
  assert.deepEqual(states({ failure: { code: "terminal.ConnectTimeout" } }), [
    "connect:failed",
    "auth:pending",
    "session:pending",
  ]);
});

test("a changed fingerprint fails the fingerprint step even if none was asked", () => {
  assert.deepEqual(states({ failure: { code: "terminal.ServerKeyChanged" } }), [
    "connect:done",
    "trust:failed",
    "auth:pending",
    "session:pending",
  ]);
});

test("opened completes every step; local has no network steps", () => {
  assert.ok(states({ opened: true }).every((s) => s.endsWith(":done")));
  assert.deepEqual(states({ kind: "local" }), [
    "connect:current",
    "session:pending",
  ]);
});

test("a password request adds its step after authentication", () => {
  const asking = { phase: "auth", passwords: 1 };
  assert.deepEqual(states(asking), [
    "connect:done",
    "auth:done",
    "password:current",
    "session:pending",
  ]);
  assert.deepEqual(
    states({ ...asking, failure: { code: "terminal.AuthRefused" } }),
    ["connect:done", "auth:done", "password:failed", "session:pending"],
  );
  assert.ok(
    states({ ...asking, opened: true }).every((s) => s.endsWith(":done")),
  );
});

test("each refused password adds one more step", () => {
  const asking = { phase: "auth", passwords: 3 };
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
    "Password (attempt 2)",
  );
  assert.deepEqual(
    states({
      ...asking,
      failure: { code: "terminal.PasswordsExhausted", params: 3 },
    }),
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
    auth: { message: { code: "step.keyRefused" }, warn: true },
    password: { message: { code: "step.passwordAccepted" }, warn: false },
  };
  const steps = timelineSteps({
    ...base,
    phase: "session",
    passwords: 1,
    details,
  });
  assert.deepEqual(
    steps.map((s) => s.id + ":" + s.state + ":" + (s.detail ?? "")),
    [
      "connect:done:Known host, fingerprint matches",
      "auth:warning:Key refused by the server",
      "password:done:Password accepted",
      "session:current:",
    ],
  );
});

test("details: known host, new fingerprint, key name", () => {
  const detail = (
    o: Partial<Parameters<typeof timelineSteps>[0]>,
    id: string,
  ) => timelineSteps({ ...base, ...o }).find((s) => s.id === id)?.detail;
  const done = { phase: "session" };
  assert.equal(detail(done, "connect"), "Known host, fingerprint matches");
  assert.equal(detail({ ...done, askedTrust: true }, "connect"), undefined);
  assert.equal(
    detail({ ...done, askedTrust: true }, "trust"),
    "New fingerprint confirmed",
  );
  const key = {
    auth: {
      message: { code: "step.authKeyNamed", params: { name: "k" } },
      warn: false,
    },
  };
  assert.equal(
    detail({ ...done, details: key }, "auth"),
    "Authenticated with the key “k”",
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

test("the port shows only when it is not 22", () => {
  assert.equal(targetLabel("srv.example", 22), "srv.example");
  assert.equal(targetLabel("srv.example", 2222), "srv.example:2222");
});
