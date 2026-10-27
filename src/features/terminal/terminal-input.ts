// Pure helpers for what goes into and comes out of the terminal pane.

// Pasted text may carry ESC (closing bracketed paste early and running what follows),
// other C0 controls, DEL and C1 controls. Only line breaks and tabs are legitimate.
export function sanitizePaste(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}

const PASTE_CONFIRM_LINES = 20;
export function pasteLineCount(text: string): number {
  return text.split("\n").length;
}
export function needsPasteConfirm(
  text: string,
  limit = PASTE_CONFIRM_LINES,
): boolean {
  return pasteLineCount(text) > limit;
}

// Sticky modes a dead session can leave behind: bracketed paste, mouse tracking,
// alternate screen, hidden cursor.
export const RESET_MODES =
  "\x1b[?2004l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1049l\x1b[?25h";

export type TerminalKeyAction =
  | "copy"
  | "paste"
  | "search"
  | "line-kill"
  | "word-back"
  | "word-forward"
  | "swallow";

// Shortcut the pane handles itself, or "swallow" to keep the key away from the shell.
// `e` is a keydown event; returns undefined for keys xterm should process as usual.
export function terminalKeyAction(
  e: Pick<
    KeyboardEvent,
    "type" | "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
  >,
  mac: boolean,
  hasSelection: boolean,
): TerminalKeyAction | undefined {
  if (e.type !== "keydown") return undefined;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const primary = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (mac) {
    if (primary && !e.altKey && !e.shiftKey) {
      if (key === "c") return hasSelection ? "copy" : "swallow";
      if (key === "f") return "search";
      if (key === "Backspace") return "line-kill";
    }
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      if (key === "ArrowLeft") return "word-back";
      if (key === "ArrowRight") return "word-forward";
    }
    return undefined;
  }
  if (primary && !e.altKey) {
    if (e.shiftKey) {
      if (key === "c") return "copy";
      if (key === "v") return "paste";
      if (key === "f") return undefined; // Ctrl+Shift+F searches the vault
    } else {
      if (key === "c" && hasSelection) return "copy";
      if (key === "f") return "search";
    }
  }
  return undefined;
}

export const WORD_BACK = "\x1bb";
export const WORD_FORWARD = "\x1bf";
export const LINE_KILL = "\x15";
