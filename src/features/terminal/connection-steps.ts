// The steps of the connection timeline, derived from what the session reports.
// Statuses come from the Rust side (terminal.rs `open`); the UI text is Italian.
export type StepState = "done" | "warning" | "current" | "failed" | "pending";
export type TimelineStep = {
  // "password" for the first question, "password-2"… for each one after a refusal
  id: string;
  label: string;
  state: StepState;
  detail?: string;
};
/** How a step ended, as reported by the Rust side. `warn` is a partial result, e.g. a fallback. */
export type StepNote = { text: string; warn: boolean };
// Passwords the user may type per connection; the same limit as MAX_PASSWORD_ATTEMPTS in terminal/connection.rs.
export const MAX_PASSWORD_ATTEMPTS = 3;

const CHANGED = "Identità del server cambiata";

/** "indirizzo", or "indirizzo:porta" when the port is not the default 22. */
export const targetLabel = (address: string, port: number) =>
  port === 22 ? address : `${address}:${port}`;

function stageOf(phase: string): "connect" | "auth" | "session" {
  if (/^(Apertura del terminale|Connesso)/.test(phase)) return "session";
  if (
    phase === "Autenticazione SSH" ||
    phase === "Impronta del server verificata"
  )
    return "auth";
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
  failure: string;
  opened: boolean;
  passwords?: number;
  details?: Record<string, StepNote>;
  // A quick connection still asking: the question being answered, and whether a second one
  // (password or key) follows. Undefined once everything is known.
  setup?: { stage: "user" | "method" | null; method: boolean };
}): TimelineStep[] {
  const changed = !!failure && failure.includes(CHANGED);
  const remote = kind !== "local";
  const passwordSteps = Array.from({ length: passwords }, (_, i) => ({
    id: i === 0 ? "password" : `password-${i + 1}`,
    label: i === 0 ? "Password" : `Password (tentativo ${i + 1})`,
  }));
  const steps: Omit<TimelineStep, "state">[] = [
    ...(setup
      ? [
          { id: "user", label: "Utente" },
          ...(setup.method
            ? [{ id: "method", label: "Metodo di accesso" }]
            : []),
        ]
      : []),
    {
      id: "connect",
      label: remote ? `Connessione a ${target}` : "Avvio del terminale locale",
    },
    ...(remote && (askedTrust || changed)
      ? [{ id: "trust", label: "Verifica impronta" }]
      : []),
    ...(remote ? [{ id: "auth", label: "Autenticazione" }] : []),
    ...passwordSteps,
    { id: "session", label: "Sessione aperta" },
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
    let detail = note?.text;
    if (done && step.id === "trust" && askedTrust)
      detail = "Nuova impronta confermata";
    if (done && step.id === "connect" && remote && !askedTrust && !changed)
      detail = "Host già noto, impronta coincide";
    return { ...step, state, detail: done ? detail : undefined };
  });
}
