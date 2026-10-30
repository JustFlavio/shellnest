// The connection log: one entry per message the session reports, with what a reader needs to scan it.
// Messages are codes from the Rust side (ssh/mod.rs); the kind is the second part of a `log.` code.
import { i18n, t } from "../../i18n/i18n.ts";
import { translateMessage } from "../../i18n/message.ts";
import type { Message } from "../../i18n/message.ts";

export type LogEntry = { message: Message; at: number };
export type LogKind =
  "network" | "fingerprint" | "auth" | "tech" | "error" | "success";
export type LogSegment = { text: string; strong: boolean };

const KINDS: readonly LogKind[] = [
  "network",
  "fingerprint",
  "auth",
  "tech",
  "error",
  "success",
];

export const kindLabel = (kind: LogKind): string =>
  t(`connection.kind.${kind}`);

/** `log.<kind>.…` codes carry their kind; any other code is an error. */
export function logKind(message: Message): LogKind {
  const [scope, kind] = message.code.split(".");
  return scope === "log"
    ? (KINDS.find((k) => k === kind) ?? "network")
    : "error";
}

/** A message of the connection (`log.…`, `step.…`) or an error code, in the active language. */
export function connectionText(message: Message): string {
  const scope = /^(log|step)\./.test(message.code) ? "connection" : "error";
  return translateMessage(message, scope);
}

const TAG = /<\/?b>/g;
const plain = (text: string) => text.replace(TAG, "");

/** "+0.3 s" from the start of the attempt; minutes once it takes longer than a minute and a half. */
export function formatOffset(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 90)
    return t("connection.offsetSeconds", {
      value: new Intl.NumberFormat(i18n.language, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(seconds),
    });
  return t("connection.offsetMinutes", {
    minutes: Math.floor(seconds / 60),
    seconds: String(Math.floor(seconds % 60)).padStart(2, "0"),
  });
}

export const logText = (entries: LogEntry[]) =>
  entries
    .map((e) => `${formatOffset(e.at)}  ${plain(connectionText(e.message))}`)
    .join("\n");

/** The line cut into plain and emphasised parts; the translation marks values with <b>. Technical lines and errors stay plain. */
export function logSegments(message: Message): LogSegment[] {
  const text = connectionText(message);
  const kind = logKind(message);
  if (kind === "tech" || kind === "error")
    return [{ text: plain(text), strong: false }];
  const parts: LogSegment[] = [];
  let at = 0;
  for (const m of text.matchAll(/<b>(.*?)<\/b>/g)) {
    if (m.index > at)
      parts.push({ text: plain(text.slice(at, m.index)), strong: false });
    parts.push({ text: m[1], strong: true });
    at = m.index + m[0].length;
  }
  if (at < text.length)
    parts.push({ text: plain(text.slice(at)), strong: false });
  return parts;
}

/** Whether the view is at the end of its content, give or take a few pixels. */
export const atBottom = (
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  slack = 24,
) => scrollHeight - scrollTop - clientHeight <= slack;
