import type { RefObject } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import type { Output, TerminalTab } from "@/lib/types";
import { MAX_PASSWORD_ATTEMPTS } from "./connection-steps.ts";
import { RESET_MODES } from "./terminal-input.ts";
import { terminalInputChunks } from "./workbench-state.ts";
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
  log: (text: string) => void;
  detail: (step: string, text: string, warn: boolean) => void;
  opened: () => void;
  failure: (text: string, log?: boolean) => void;
  // the server needs a password; true when the previous one was refused
  password: (refused: boolean) => void;
};

// The preview has no server: it accepts this password and refuses any other.
const PREVIEW_PASSWORD = "password-giusta";
const previewAnswers = new Map<string, (password: string) => void>();

/** Sends the password the server asked for; it is not kept anywhere on the way. */
export function sendSessionPassword(tab: TerminalTab, password: string) {
  if (!desktop) {
    previewAnswers.get(tab.id)?.(password);
    return Promise.resolve();
  }
  return invoke<void>("terminal_password", {
    vaultId: tab.vaultId,
    sessionId: tab.id,
    password,
  });
}

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
    if (event.type === "log") ui.log(event.data);
    if (event.type === "detail")
      ui.detail(event.data.step, event.data.text, event.data.warn);
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
    if (event.type === "password") ui.password(event.data);
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
  if (!desktop) return startPreview(tab, handle, term, prompt, stop);
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

// The preview replays a real connection. Addresses ending in .slow.test stay in the authentication
// stage, .fail.test ends there with an error and .password.test has the key refused and asks
// for a password (the right one is PREVIEW_PASSWORD; MAX_PASSWORD_ATTEMPTS wrong ones end it).
function startPreview(
  tab: TerminalTab,
  handle: (event: Output) => void,
  term: Xterm["term"],
  prompt: string,
  stop: () => void,
) {
  const address = tab.kind === "ssh" ? tab.host.address : "";
  const timers: number[] = [];
  const at = (ms: number, event: Output | (() => void)) =>
    timers.push(
      window.setTimeout(
        typeof event === "function" ? event : () => handle(event),
        ms,
      ),
    );
  const log = (data: string): Output => ({ type: "log", data });
  const status = (data: string): Output => ({ type: "status", data });
  const detail = (step: string, text: string, warn = false): Output => ({
    type: "detail",
    data: { step, text, warn },
  });
  const byPassword =
    tab.kind === "ssh" && tab.identityName === "Credenziali dell’host";
  const banner = () =>
    term.write(
      "\x1b[90mSessione dimostrativa: nessuna connessione reale.\x1b[0m\r\n" +
        prompt,
    );
  const open = (ms: number, step: string, text: string) => {
    at(ms, status("Apertura del terminale remoto"));
    at(ms, detail(step, text));
    at(ms, log("Apertura di terminale e shell remota"));
    at(ms + 70, status("Connesso"));
    at(ms + 120, banner);
  };
  at(0, status("Connessione al server SSH"));
  at(0, log(`Risoluzione di ${address}:22`));
  at(0, log("Indirizzi trovati: 192.0.2.10"));
  at(60, status("Impronta del server verificata"));
  at(60, log("Connessione stabilita"));
  at(60, detail("connect", "SSH-2.0-OpenSSH_9.6"));
  at(60, log("Server remoto: SSH-2.0-OpenSSH_9.6"));
  at(
    60,
    log(
      "Algoritmi negoziati: scambio chiavi curve25519-sha256, chiave host ssh-ed25519, cifrario chacha20-poly1305@openssh.com",
    ),
  );
  at(
    60,
    log("Impronta del server nota e coincidente: SHA256:impronta-dimostrativa"),
  );
  at(120, status("Autenticazione SSH"));
  if (address.endsWith(".fail.test")) {
    at(180, log("Autenticazione con chiave rifiutata dal server"));
    at(180, log("Metodi ancora accettati dal server: keyboard-interactive"));
    at(250, {
      type: "error",
      data: "Autenticazione fallita",
    });
  } else if (address.endsWith(".password.test")) {
    let wrong = 0;
    at(180, log("Autenticazione con chiave rifiutata dal server"));
    at(180, log("Metodi ancora accettati dal server: password, publickey"));
    at(180, detail("auth", "Chiave rifiutata dal server", true));
    at(180, { type: "password", data: false });
    previewAnswers.set(tab.id, (password) => {
      const n = wrong + 1;
      const step = n === 1 ? "password" : `password-${n}`;
      at(60, log(`Tentativo con password ${n} di ${MAX_PASSWORD_ATTEMPTS}`));
      if (password === PREVIEW_PASSWORD) {
        at(60, log("Password accettata"));
        open(60, step, "Password accettata");
        return;
      }
      wrong = n;
      at(60, log("Password rifiutata dal server"));
      at(60, detail(step, "Password non accettata", true));
      if (n >= MAX_PASSWORD_ATTEMPTS)
        at(60, {
          type: "error",
          data: `Password non accettata dopo ${MAX_PASSWORD_ATTEMPTS} tentativi.`,
        });
      else at(60, { type: "password", data: true });
    });
  } else if (!address.endsWith(".slow.test")) {
    at(180, log("Autenticazione accettata"));
    open(
      180,
      "auth",
      byPassword
        ? "Autenticato con la password"
        : `Autenticato con la chiave “${tab.kind === "ssh" ? tab.identityName : ""}”`,
    );
  }
  return () => {
    stop();
    previewAnswers.delete(tab.id);
    timers.forEach(window.clearTimeout);
  };
}
