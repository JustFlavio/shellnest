// The connection log: one entry per line the session reports, with what a reader needs to scan it.
// Lines are Italian text from the Rust side (terminal/connection.rs), so the kind is read off the wording.
export type LogEntry = { text: string; at: number };
export type LogKind =
  "network" | "fingerprint" | "auth" | "tech" | "error" | "success";
export type LogSegment = { text: string; strong: boolean };

export const KIND_LABEL: Record<LogKind, string> = {
  network: "Rete",
  fingerprint: "Impronta",
  auth: "Autenticazione",
  tech: "Dettaglio tecnico",
  error: "Problema",
  success: "Riuscito",
};

const FAILED =
  /^Errore:|rifiutat|fallit|non riuscit|non accettat|cambiata|annullat/i;

export function logKind(text: string): LogKind {
  if (FAILED.test(text)) return "error";
  if (/^Algoritmi/.test(text)) return "tech";
  if (/ accettata$/.test(text)) return "success";
  if (/^Impronta/.test(text)) return "fingerprint";
  if (/^(Autenticazione|Tentativo|Metodi|Password)/.test(text)) return "auth";
  return "network";
}

/** "+0,3 s" from the start of the attempt; minutes once it takes longer than a minute and a half. */
export function formatOffset(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 90) return `+${seconds.toFixed(1).replace(".", ",")} s`;
  const minutes = Math.floor(seconds / 60);
  return `+${minutes} min ${String(Math.floor(seconds % 60)).padStart(2, "0")} s`;
}

export const logText = (entries: LogEntry[]) =>
  entries.map((e) => `${formatOffset(e.at)}  ${e.text}`).join("\n");

// What to emphasise in a line: the value after a colon, the host being resolved, the user, the method.
const EMPHASIS = [
  /: (.+)$/,
  /^Risoluzione di (.+)$/,
  /per l’utente (.+)$/,
  /^Autenticazione con (chiave|password salvata|password)/,
];

/** The line cut into plain and emphasised parts. Technical lines and errors stay plain. */
export function logSegments(text: string, kind: LogKind): LogSegment[] {
  if (kind === "tech" || kind === "error") return [{ text, strong: false }];
  const ranges = EMPHASIS.flatMap((pattern) => {
    const m = pattern.exec(text);
    if (!m) return [];
    const start = m.index + m[0].lastIndexOf(m[1]);
    return [[start, start + m[1].length]];
  }).sort((a, b) => a[0] - b[0]);
  const parts: LogSegment[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at) continue;
    if (start > at) parts.push({ text: text.slice(at, start), strong: false });
    parts.push({ text: text.slice(start, end), strong: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), strong: false });
  return parts;
}

/** Whether the view is at the end of its content, give or take a few pixels. */
export const atBottom = (
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  slack = 24,
) => scrollHeight - scrollTop - clientHeight <= slack;
