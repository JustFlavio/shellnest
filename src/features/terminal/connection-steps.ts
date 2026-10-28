// The steps of the connection timeline, derived from what the session reports.
// Statuses are stage ids sent by the Rust side (terminal/connection.rs `open`).
import { i18n, t } from "../../i18n/i18n.ts";
import type { Message } from "../../i18n/message.ts";
import { connectionText } from "./connection-log.ts";
export type StepState = "done" | "warning" | "current" | "failed" | "pending";
export type TimelineStep = {
  // "password" for the first question, "password-2"… for each one after a refusal
  id: string;
  label: string;
  state: StepState;
  detail?: string;
};
/** How a step ended, as reported by the Rust side. `warn` is a partial result, e.g. a fallback. */
export type StepNote = { message?: Message; text?: string; warn: boolean };

/** The label of a stage id sent by the Rust side, in the active language. */
export function phaseText(phase: string): string {
  const key = `connection.phase.${phase}`;
  return i18n.exists(key) ? i18n.t(key as never) : phase;
}
// Passwords the user may type per connection; the same limit as MAX_PASSWORD_ATTEMPTS in terminal/connection.rs.
export const MAX_PASSWORD_ATTEMPTS = 3;

/** "indirizzo", or "indirizzo:porta" when the port is not the default 22. */
export const targetLabel = (address: string, port: number) =>
  port === 22 ? address : `${address}:${port}`;

function stageOf(phase: string): "connect" | "auth" | "session" {
  if (phase === "session" || phase === "connected") return "session";
  if (phase === "auth" || phase === "verified") return "auth";
  return "connect";
}

/**
 * kind: tab kind. target: as shown after "Connessione a". askedTrust: the host key had to be verified in this pane.
 * awaitingTrust: the user has not answered yet. phase/failure: last status and error. opened: terminal is up.
 * passwords: how many times the server asked for a password so far (each question is a step).
 * details: how finished steps ended, by step id.
 */
export function timelineSteps({
  kind,
  target,
  askedTrust,
  awaitingTrust,
  phase,
  failure,
  opened,
  passwords = 0,
  details = {},
  setup,
}: {
  kind: "ssh" | "quick" | "local";
  target: string;
  askedTrust: boolean;
  awaitingTrust: boolean;
  phase: string;
  failure: Message | null;
  opened: boolean;
  passwords?: number;
  details?: Record<string, StepNote>;
  // A quick connection still asking: the question being answered, and whether a second one
  // (password or key) follows. Undefined once everything is known.
  setup?: { stage: "user" | "method" | null; method: boolean };
}): TimelineStep[] {
  const changed = failure?.code === "terminal.ServerKeyChanged";
  const remote = kind !== "local";
  const passwordSteps = Array.from({ length: passwords }, (_, i) => ({
    id: i === 0 ? "password" : `password-${i + 1}`,
    label:
      i === 0
        ? t("connection.timeline.password")
        : t("connection.timeline.passwordAttempt", { n: i + 1 }),
  }));
  const steps: Omit<TimelineStep, "state">[] = [
    ...(setup
      ? [
          { id: "user", label: t("connection.timeline.user") },
          ...(setup.method
            ? [{ id: "method", label: t("connection.timeline.method") }]
            : []),
        ]
      : []),
    {
      id: "connect",
      label: remote
        ? t("connection.timeline.connectRemote", { target })
        : t("connection.timeline.connectLocal"),
    },
    ...(remote && (askedTrust || changed)
      ? [{ id: "trust", label: t("connection.timeline.trust") }]
      : []),
    ...(remote ? [{ id: "auth", label: t("connection.timeline.auth") }] : []),
    ...passwordSteps,
    { id: "session", label: t("connection.timeline.session") },
  ];
  const stage = stageOf(phase);
  const current = opened
    ? steps.length
    : setup?.stage
      ? steps.findIndex((s) => s.id === setup.stage)
      : awaitingTrust || changed
        ? steps.findIndex((s) => s.id === "trust")
        : !remote
          ? 0
          : passwords > 0 && stage === "auth"
            ? steps.findIndex((s) => s.id === passwordSteps[passwords - 1].id)
            : steps.findIndex((s) => s.id === stage);
  return steps.map((step, i): TimelineStep => {
    const note = details[step.id];
    const state: StepState =
      i < current
        ? note?.warn
          ? "warning"
          : "done"
        : i > current
          ? "pending"
          : failure
            ? "failed"
            : "current";
    const done = state === "done" || state === "warning";
    let detail =
      note && (note.text ?? (note.message && connectionText(note.message)));
    if (done && step.id === "trust" && askedTrust)
      detail = t("connection.timeline.trustConfirmed");
    if (done && step.id === "connect" && remote && !askedTrust && !changed)
      detail = t("connection.timeline.hostKnown");
    return { ...step, state, detail: done ? detail : undefined };
  });
}
