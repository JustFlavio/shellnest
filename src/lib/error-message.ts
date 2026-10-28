import { toMessage, translateMessage } from "../i18n/message.ts";

/** The text of a rejected promise: Tauri rejects with a coded message, the demo and the runtime with an Error or a string. */
export function describeError(error: unknown): string {
  return translateMessage(toMessage(error), "error");
}

/** The same failure always gets the same id, so a repeat updates the toast already on screen. */
export function errorToastId(title: string, description: string): string {
  return `error:${title}:${description}`;
}
