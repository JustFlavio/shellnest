// The steps of the connection timeline, derived from what the session reports.
// Statuses come from the Rust side (terminal.rs `open`); the UI text is Italian.
const CHANGED = "Identità del server cambiata";

function stageOf(phase) {
  if (/^(Apertura del terminale|Connesso)/.test(phase)) return "session";
  if (
    phase === "Autenticazione SSH" ||
    phase === "Impronta del server verificata"
  )
    return "auth";
  return "connect";
}

/**
 * kind: tab kind. target: "host:porta". askedTrust: the host key had to be verified in this pane.
 * awaitingTrust: the user has not answered yet. phase/failure: last status and error. opened: terminal is up.
 * password: null until the server asked for one, then true while waiting for the user.
 * Each step is { id, label, state: "done" | "current" | "failed" | "pending" }.
 */
export function timelineSteps({
  kind,
  target,
  askedTrust,
  awaitingTrust,
  phase,
  failure,
  opened,
  password,
}) {
  const changed = !!failure && failure.includes(CHANGED);
  const remote = kind !== "local";
  const steps = [
    {
      id: "connect",
      label: remote ? `Connessione a ${target}` : "Avvio del terminale locale",
    },
    ...(remote && (askedTrust || changed)
      ? [{ id: "trust", label: "Verifica impronta" }]
      : []),
    ...(remote ? [{ id: "auth", label: "Autenticazione" }] : []),
    ...(password !== null && password !== undefined
      ? [{ id: "password", label: "Password" }]
      : []),
    { id: "session", label: "Sessione aperta" },
  ];
  const current = opened
    ? steps.length
    : awaitingTrust || changed
      ? steps.findIndex((s) => s.id === "trust")
      : steps.findIndex(
          (s) =>
            s.id ===
            (!remote
              ? "connect"
              : password !== null &&
                  password !== undefined &&
                  stageOf(phase) === "auth"
                ? "password"
                : stageOf(phase)),
        );
  return steps.map((step, i) => ({
    ...step,
    state:
      i < current
        ? "done"
        : i > current
          ? "pending"
          : failure
            ? "failed"
            : "current",
  }));
}
