export function sanitizePaste(text: string): string;
export const PASTE_CONFIRM_LINES: number;
export function pasteLineCount(text: string): number;
export function needsPasteConfirm(text: string, limit?: number): boolean;
export const RESET_MODES: string;
export type TerminalKeyAction =
  | "copy"
  | "paste"
  | "search"
  | "line-kill"
  | "word-back"
  | "word-forward"
  | "swallow";
export function terminalKeyAction(
  e: Pick<
    KeyboardEvent,
    "type" | "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
  >,
  mac: boolean,
  hasSelection: boolean,
): TerminalKeyAction | undefined;
export const WORD_BACK: string;
export const WORD_FORWARD: string;
export const LINE_KILL: string;
