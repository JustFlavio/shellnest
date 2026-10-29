import type { RefObject } from "react";
import { t } from "@/i18n/i18n";
import { toMessage, translateMessage } from "@/i18n/message";
import type { Message } from "@/i18n/message";
import { describeError } from "@/lib/error-message";
import { Channel, invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import type { Output, TerminalTab } from "@/lib/types";
import { inputForPeer } from "./broadcast.ts";
import { MAX_PASSWORD_ATTEMPTS } from "./connection-steps.ts";
import {
  broadcastTargets,
  sessionInputs,
  terminalHandles,
} from "./terminal-handles";
import { takeQuickPassword } from "./quick-password";
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

export type SessionUi = {
  status: (stage: string) => void;
  log: (message: Message) => void;
  detail: (step: string, message: Message, warn: boolean) => void;
  opened: () => void;
  failure: (message: Message, log?: boolean) => void;
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
  const prompt = `\x1b[32m${tab.kind === "ssh" ? tab.host.username || "root" : tab.kind === "quick" ? tab.username || "root" : "demo"}@${tab.kind === "ssh" ? tab.host.name : tab.kind === "quick" ? tab.target.address : t("terminal.localHost")}\x1b[0m:\x1b[34m~\x1b[0m$ `;
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
        if (!disposed) callbacks.current.onError(describeError(e));
      });
  };
  sessionInputs.set(tab.id, send);
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
  const fail = (message: Message) => {
    failed = true;
    ui.failure(message);
    callbacks.current.onStatus(tab.id, "failed");
    resetModes();
    term.writeln(`\r\n\x1b[31m${translateMessage(message, "error")}\x1b[0m`);
  };
  const disconnect = () => void invoke("disconnect", session).catch(() => {});
  const handle = (event: Output) => {
    if (disposed) return;
    if (event.type === "data") term.write(new Uint8Array(event.data));
    if (event.type === "status") ui.status(event.data);
    if (event.type === "log") ui.log(event.data);
    if (event.type === "detail")
      ui.detail(event.data.step, event.data.text, event.data.warn);
    if (event.type === "status" && event.data === "connected") {
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
        ui.failure({ code: "session.EndedEarly" }, false);
        callbacks.current.onStatus(tab.id, "failed");
      }
      ready = false;
      pendingInput = "";
      if (!failed) callbacks.current.onStatus(tab.id, "closed");
      resetModes();
      term.writeln(`\r\n\x1b[90m${t("terminal.sessionEnded")}\x1b[0m`);
      disconnect();
    }
  };
  const listeners = [
    term.onData((data) => {
      // Typing or pasting is the end of a copy: like every terminal, drop the selection.
      if (term.hasSelection()) term.clearSelection();
      if (ready) {
        send(data);
        for (const id of broadcastTargets.get(tab.id) ?? [])
          sessionInputs.get(id)?.(
            inputForPeer(
              data,
              !!terminalHandles.get(id)?.modes.bracketedPasteMode,
            ),
          );
      } else if (!pendingOverflow) {
        if (pendingInput.length + data.length <= MAX_EARLY_INPUT)
          pendingInput += data;
        else {
          pendingOverflow = true;
          pendingInput = "";
          callbacks.current.onError(t("terminal.inputTooLong"));
        }
      }
    }),
    term.onResize(sendSize),
  ];
  const stop = () => {
    disposed = true;
    sessionInputs.delete(tab.id);
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
  else if (tab.kind === "quick") {
    const { address, port, username, login, expectedFingerprint } = tab.target;
    request = invoke("connect_quick", {
      ...base,
      address,
      port,
      username: username ?? null,
      identityId: login?.kind === "identity" ? login.id : "",
      keyId: login?.kind === "key" ? login.id : "",
      password: takeQuickPassword(tab.id) ?? null,
      expectedFingerprint,
    });
  } else request = invoke("connect", { ...base, id: tab.host.id });
  request.catch((e) => {
    if (!disposed) {
      ready = false;
      fail(toMessage(e));
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
  const address =
    tab.kind === "ssh"
      ? tab.host.address
      : tab.kind === "quick"
        ? tab.target.address
        : "";
  const timers: number[] = [];
  const at = (ms: number, event: Output | (() => void)) =>
    timers.push(
      window.setTimeout(
        typeof event === "function" ? event : () => handle(event),
        ms,
      ),
    );
  const log = (code: string, params?: object): Output => ({
    type: "log",
    data: { code, params },
  });
  const status = (data: string): Output => ({ type: "status", data });
  const detail = (step: string, code: string, params?: object, warn = false) =>
    ({
      type: "detail",
      data: { step, text: { code, params }, warn },
    }) satisfies Output;
  const byPassword = tab.kind !== "local" && !tab.identityName;
  const banner = () =>
    term.write(`\x1b[90m${t("terminal.demoBanner")}\x1b[0m\r\n` + prompt);
  const open = (ms: number, step: string, code: string, params?: object) => {
    at(ms, status("session"));
    at(ms, detail(step, code, params));
    at(ms, log("log.network.opening"));
    at(ms + 70, status("connected"));
    at(ms + 120, banner);
  };
  at(0, status("connect"));
  at(0, log("log.network.resolving", { target: `${address}:22` }));
  at(0, log("log.network.addresses", { list: "192.0.2.10" }));
  at(60, status("verified"));
  at(60, log("log.network.connected"));
  at(60, log("log.network.server", { banner: "SSH-2.0-OpenSSH_9.6" }));
  at(
    60,
    log("log.tech.algorithms", {
      kex: "curve25519-sha256",
      hostKey: "ssh-ed25519",
      cipher: "chacha20-poly1305@openssh.com",
    }),
  );
  at(
    60,
    log("log.fingerprint.known", {
      fingerprint: "SHA256:impronta-dimostrativa",
    }),
  );
  at(120, status("auth"));
  if (address.endsWith(".fail.test")) {
    at(180, log("log.error.keyRefused"));
    at(180, log("log.auth.methodsLeft", { methods: "keyboard-interactive" }));
    at(250, {
      type: "error",
      data: {
        code: "terminal.AuthRefused",
        params: { methods: "keyboard-interactive", context: "unsupported" },
      },
    });
  } else if (address.endsWith(".password.test")) {
    let wrong = 0;
    at(180, log("log.error.keyRefused"));
    at(180, log("log.auth.methodsLeft", { methods: "password, publickey" }));
    at(180, detail("auth", "step.keyRefused", undefined, true));
    at(180, { type: "password", data: false });
    previewAnswers.set(tab.id, (password) => {
      const n = wrong + 1;
      const step = n === 1 ? "password" : `password-${n}`;
      at(
        60,
        log("log.auth.passwordAttempt", {
          sent: n,
          max: MAX_PASSWORD_ATTEMPTS,
        }),
      );
      if (password === PREVIEW_PASSWORD) {
        at(60, log("log.success.passwordOk"));
        open(60, step, "step.passwordAccepted");
        return;
      }
      wrong = n;
      at(60, log("log.error.passwordRefused"));
      at(60, detail(step, "step.passwordRefused", undefined, true));
      if (n >= MAX_PASSWORD_ATTEMPTS)
        at(60, {
          type: "error",
          data: {
            code: "terminal.PasswordsExhausted",
            params: MAX_PASSWORD_ATTEMPTS,
          },
        });
      else at(60, { type: "password", data: true });
    });
  } else if (!address.endsWith(".slow.test")) {
    at(
      180,
      log(
        byPassword ? "log.success.passwordAccepted" : "log.success.keyAccepted",
      ),
    );
    if (byPassword) open(180, "auth", "step.authPassword");
    else open(180, "auth", "step.authKeyNamed", { name: tab.identityName });
  }
  return () => {
    stop();
    previewAnswers.delete(tab.id);
    timers.forEach(window.clearTimeout);
  };
}
