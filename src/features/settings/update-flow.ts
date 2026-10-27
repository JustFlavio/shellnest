// Pure parts of the update flow: what the status is, how a failure reads and how far a download is.
import { describeError } from "../../lib/error-message.ts";

/** The check runs this long after launch, so it never competes with the unlock screen for the network. */
export const LAUNCH_CHECK_DELAY_MS = 5000;

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "uptodate" }
  | { kind: "available"; version: string }
  | { kind: "downloading"; version: string; percent: number | null }
  | { kind: "ready"; version: string }
  | { kind: "installing"; version: string }
  | { kind: "error"; message: string };

/** Whole percent of a download, or null while the server did not announce a size. */
export function percentOf(done: number, total?: number): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.floor((done / total) * 100)));
}

/** A failure in plain Italian for the usual causes; anything else keeps the plugin's own text. */
export function updateFailure(error: unknown): string {
  const text = describeError(error);
  if (/pubkey|public key|base64|signature|minisign/i.test(text))
    return "la chiave di firma degli aggiornamenti non è valida o non è stata configurata";
  if (
    /network|dns|connect|timed? ?out|error sending request|offline/i.test(text)
  )
    return "server non raggiungibile, controlla la connessione";
  if (/valid release json|404|not found/i.test(text))
    return "nessun elenco di aggiornamenti trovato sul server";
  return text || "errore sconosciuto";
}

/** True while a check, download or install is running, so a second one must not start. */
export const isBusy = (status: UpdateStatus): boolean =>
  status.kind === "checking" ||
  status.kind === "downloading" ||
  status.kind === "installing";

/** One line for the settings card. */
export function statusLine(status: UpdateStatus): string {
  switch (status.kind) {
    case "idle":
      return "Nessun controllo eseguito in questa sessione.";
    case "checking":
      return "Controllo in corso…";
    case "uptodate":
      return "Stai usando l’ultima versione.";
    case "available":
      return `Disponibile la versione ${status.version}.`;
    case "downloading":
      return status.percent === null
        ? `Download della versione ${status.version}…`
        : `Download della versione ${status.version}: ${status.percent}%`;
    case "ready":
      return `La versione ${status.version} è pronta: riavvia per installarla.`;
    case "installing":
      return `Installazione della versione ${status.version}…`;
    case "error":
      return `Controllo non riuscito: ${status.message}`;
  }
}
