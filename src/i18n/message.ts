// What the Rust side sends in place of text: a code and its parameters, translated here.
import { i18n } from "./i18n.ts";

export type Message = { code: string; params?: unknown };

const isMessage = (value: unknown): value is Message =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Message).code === "string";

/** Any rejection as a message: a coded one is kept, anything else travels as its text. */
export function toMessage(error: unknown): Message {
  if (isMessage(error)) return error;
  const text = error instanceof Error ? error.message : String(error);
  return {
    code: "app.Raw",
    params: text.replace(/^(\w*Error: )+/, "").trim(),
  };
}

// A lone number or string is the value of a one-field variant; a number also drives the plural.
function paramsOf(params: unknown): Record<string, unknown> {
  if (typeof params === "number") return { value: params, count: params };
  if (typeof params === "string") return { value: params };
  return params && typeof params === "object"
    ? (params as Record<string, unknown>)
    : {};
}

/** The message in the active language, or its code when no text exists for it. */
export function translateMessage(message: Message, scope: string): string {
  const key = `${scope}.${message.code}`;
  const params = paramsOf(message.params);
  // `exists` needs the parameters too: a plural key only exists as `_one`, `_other`.
  if (!i18n.exists(key as never, params as never)) return message.code;
  return String(i18n.t(key as never, params as never));
}
