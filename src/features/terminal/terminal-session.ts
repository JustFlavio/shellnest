import type { RefObject } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import type { Output, TerminalTab } from "@/lib/types";
import { RESET_MODES } from "./terminal-input.mjs";
import { terminalInputChunks } from "./workbench-state.mjs";
import type { Xterm } from "./xterm";

export type SessionCallbacks = {
  onError: (error: string) => void;
  onStatus: (id: string, status: NonNullable<TerminalTab["status"]>) => void;
  // title set by the terminal (OSC 0/2); undefined when the session ends
  onTitle: (id: string, title?: string) => void;
  onMetadata: (vaultId: string) => void;
};

/** What the connection overlay shows. */
export type SessionUi = {
  status: (text: string) => void;
  opened: () => void;
  failure: (text: string, log?: boolean) => void;
};

const MAX_EARLY_INPUT = 32768;

/** Connects `tab` to the terminal (or to a scripted shell in the browser preview); returns the teardown. */
export function startSession(
  tab: TerminalTab,
  { term, refit }: Xterm,
  ui: SessionUi,
  callbacks: RefObject<SessionCallbacks>,
) {
  let disposed = false,
    ready = false,
    failed = false,
    inputQueue = Promise.resolve();
  let pendingInput = "";
  let pendingOverflow = false;
  const prompt = `\x1b[32m${tab.kind === "ssh" ? tab.host.username || "root" : "demo"}@${tab.kind === "ssh" ? tab.host.name : "locale"}\x1b[0m:\x1b[34m~\x1b[0m$ `;
  const session = { vaultId: tab.vaultId, sessionId: tab.id };
  const send = (data: string) => {
    if (!desktop) {
      term.write(
        data.replace(/\r/g, "\r\n" + prompt).replace(/\x7f/g, "\b \b"),
      );
      return;
    }
    inputQueue = inputQueue
      .then(async () => {
        for (const chunk of terminalInputChunks(data)) {
          if (disposed || !ready) return;
          // Chunks must reach the shell in order.
          await invoke("terminal_input", { ...session, data: chunk });
        }
      })
      .catch((e) => {
        if (!disposed) callbacks.current.onError(String(e));
      });
  };
  const sendSize = () => {
    if (ready && !disposed)
      void invoke("terminal_resize", {
        ...session,
        cols: term.cols,
        rows: term.rows,
      }).catch(() => {});
  };
  // A dead session must not leave bracketed paste, mouse tracking or the alternate screen on.
  const resetModes = () => {
    term.write(RESET_MODES);
    callbacks.current.onTitle(tab.id, undefined);
  };
  const fail = (message: string) => {
    failed = true;
    ui.failure(message);
    callbacks.current.onStatus(tab.id, "failed");
    resetModes();
    term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
    callbacks.current.onError(message);
  };
  const disconnect = () => void invoke("disconnect", session).catch(() => {});
  const handle = (event: Output) => {
    if (disposed) return;
    if (event.type === "data") term.write(new Uint8Array(event.data));
    if (event.type === "status") ui.status(event.data);
    if (event.type === "status" && event.data === "Connesso") {
      ready = true;
      ui.opened();
      pendingOverflow = false;
      callbacks.current.onStatus(tab.id, "connected");
      if (pendingInput) {
        send(pendingInput);
        pendingInput = "";
      }
      refit();
      sendSize();
      term.focus();
    }
    if (event.type === "metadata") callbacks.current.onMetadata(tab.vaultId);
    if (event.type === "error") fail(event.data);
    if (event.type === "closed") {
      if (!ready && !failed) {
        failed = true;
        ui.failure(
          "La sessione è terminata prima di aprire il terminale.",
          false,
        );
        callbacks.current.onStatus(tab.id, "failed");
      }
      ready = false;
      pendingInput = "";
      if (!failed) callbacks.current.onStatus(tab.id, "closed");
      resetModes();
      term.writeln(
        "\r\n\x1b[90mSessione terminata. Usa Riconnetti dal menu della scheda.\x1b[0m",
      );
      disconnect();
    }
  };
  const listeners = [
    term.onData((data) => {
      // Typing or pasting is the end of a copy: like every terminal, drop the selection.
      if (term.hasSelection()) term.clearSelection();
      if (ready) send(data);
      else if (!pendingOverflow) {
        if (pendingInput.length + data.length <= MAX_EARLY_INPUT)
          pendingInput += data;
        else {
          pendingOverflow = true;
          pendingInput = "";
          callbacks.current.onError(
            "Input troppo lungo prima della connessione. Attendi il prompt e incolla nuovamente.",
          );
        }
      }
    }),
    term.onResize(sendSize),
  ];
  const stop = () => {
    disposed = true;
    listeners.forEach((listener) => listener.dispose());
  };
  if (!desktop) {
    const timers = [
      window.setTimeout(
        () => handle({ type: "status", data: "Connesso" }),
        250,
      ),
      window.setTimeout(
        () =>
          term.write(
            "\x1b[90mSessione dimostrativa: nessuna connessione reale.\x1b[0m\r\n" +
              prompt,
          ),
        300,
      ),
    ];
    return () => {
      stop();
      timers.forEach(window.clearTimeout);
    };
  }
  const output = new Channel<Output>();
  output.onmessage = handle;
  const base = { ...session, output };
  let request: Promise<void>;
  if (tab.kind === "local")
    request = invoke("connect_local", {
      ...base,
      cols: term.cols,
      rows: term.rows,
    });
  else if (tab.kind === "quick")
    request = invoke("connect_quick", {
      ...base,
      ...tab.target,
      username: tab.target.username ?? null,
    });
  else request = invoke("connect", { ...base, id: tab.host.id });
  request.catch((e) => {
    if (!disposed) {
      ready = false;
      fail(String(e));
    }
  });
  return () => {
    stop();
    disconnect();
  };
}
