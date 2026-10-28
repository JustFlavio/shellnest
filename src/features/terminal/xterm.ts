import type { RefObject } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import { mac } from "@/lib/platform";
import { fontStack, terminalTheme } from "@/features/settings/settings.ts";
import type { AppSettings } from "@/features/settings/settings.ts";
import {
  LINE_KILL,
  WORD_BACK,
  WORD_FORWARD,
  needsPasteConfirm,
  sanitizePaste,
  terminalKeyAction,
} from "./terminal-input.ts";

export type XtermHandlers = {
  confirmPaste: (text: string) => void;
  search: () => void;
  title: (title?: string) => void;
};

export type Xterm = {
  term: Terminal;
  fit: FitAddon;
  search: SearchAddon;
  // fit to the container, unless it is hidden
  refit: () => void;
  dispose: () => void;
};

// Cmd/Ctrl+click on a link: the system browser (the webview itself must never navigate away).
function openLink(event: MouseEvent, uri: string) {
  if (!(mac ? event.metaKey : event.ctrlKey) || !/^https?:\/\//i.test(uri))
    return;
  if (isTauri()) void invoke("open_url", { url: uri }).catch(() => {});
  else window.open(uri, "_blank", "noopener,noreferrer");
}

const terminalOptions = (settings: AppSettings) => ({
  fontFamily: fontStack(settings.fontFamily),
  fontSize: settings.fontSize,
  scrollback: settings.scrollback,
  macOptionIsMeta: settings.optionAsMeta,
  drawBoldTextInBrightColors: settings.brightBold,
  theme: { ...terminalTheme(settings.terminalTheme).colors },
});

export function applySettings(xterm: Xterm, settings: AppSettings) {
  const next = terminalOptions(settings);
  const options = xterm.term.options;
  const resized =
    options.fontSize !== next.fontSize ||
    options.fontFamily !== next.fontFamily;
  Object.assign(options, next);
  if (resized) xterm.refit();
}

const copySelection = (term: Terminal) =>
  void navigator.clipboard.writeText(term.getSelection()).catch(() => {});

function beep() {
  try {
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    osc.frequency.value = 880;
    osc.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.08);
    osc.onended = () => void audio.close();
  } catch {}
}

export function openXterm(
  container: HTMLElement,
  settings: RefObject<AppSettings>,
  handlers: RefObject<XtermHandlers>,
): Xterm {
  const term = new Terminal({
    cursorBlink: true,
    allowProposedApi: true,
    ...terminalOptions(settings.current),
  });
  const fit = new FitAddon();
  const search = new SearchAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon(openLink));
  // Wide characters and emoji keep the columns aligned.
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = "11";
  term.loadAddon(search);
  term.open(container);
  fit.fit();
  let disposed = false;
  // Untrusted clipboard text: strip control characters (ESC could end bracketed paste
  // and run what follows) and confirm big pastes before they reach the shell.
  const paste = (raw: string) => {
    const text = sanitizePaste(raw);
    if (!text) return;
    if (needsPasteConfirm(text)) handlers.current.confirmPaste(text);
    else term.paste(text);
  };
  const pasteClipboard = () =>
    void navigator.clipboard
      .readText()
      .then(paste)
      .catch(() => {});
  const element = term.element!;
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    paste(e.clipboardData?.getData("text/plain") ?? "");
  };
  element.addEventListener("paste", onPaste, true);
  // Right click pastes (there is no context menu on the terminal).
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (settings.current.rightClickPaste) pasteClipboard();
  };
  element.addEventListener("contextmenu", onContextMenu);
  const listeners = [
    term.onSelectionChange(() => {
      if (settings.current.copyOnSelect && term.hasSelection())
        copySelection(term);
    }),
    // The bell stays silent unless the setting is on.
    term.onBell(() => {
      if (settings.current.bell) beep();
    }),
    term.onTitleChange((title) =>
      handlers.current.title(
        title.replace(/[\x00-\x1f\x7f-\x9f]/g, "").slice(0, 100) || undefined,
      ),
    ),
  ];
  // Option stays a normal modifier by default (Italian layouts type @ # [ ] with it):
  // only the arrows are mapped here; macOptionIsMeta is an opt-in setting.
  term.attachCustomKeyEventHandler((e) => {
    const action = terminalKeyAction(e, mac, term.hasSelection());
    if (!action) return true;
    e.preventDefault();
    if (action === "copy") copySelection(term);
    else if (action === "paste") pasteClipboard();
    else if (action === "search") handlers.current.search();
    else if (action === "line-kill") term.input(LINE_KILL);
    else if (action === "word-back") term.input(WORD_BACK);
    else if (action === "word-forward") term.input(WORD_FORWARD);
    return false;
  });
  return {
    term,
    fit,
    search,
    refit: () => {
      if (!disposed && container.offsetWidth) fit.fit();
    },
    dispose: () => {
      disposed = true;
      element.removeEventListener("paste", onPaste, true);
      element.removeEventListener("contextmenu", onContextMenu);
      listeners.forEach((listener) => listener.dispose());
      term.dispose();
    },
  };
}
