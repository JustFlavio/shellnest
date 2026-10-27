import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { useLatest } from "@/lib/useLatest";
import type { TerminalTab } from "@/lib/types";
import type { AppSettings } from "@/features/settings/settings.ts";
import type { LogEntry } from "./connection-log.ts";
import type { StepNote } from "./connection-steps.ts";
import { terminalHandles } from "./terminal-handles";
import { sendSessionPassword, startSession } from "./terminal-session";
import type { SessionCallbacks } from "./terminal-session";
import { applySettings, openXterm } from "./xterm";
import type { Xterm } from "./xterm";

// asks: how many times the server has asked so far; each question is a timeline step.
export type PasswordAsk = { refused: boolean; waiting: boolean; asks: number };

/** A terminal in `container` wired to the tab's session, torn down together when the tab goes. */
export function useTerminalSession({
  xterm,
  tab,
  container,
  enabled,
  settings,
  active,
  focused,
  callbacks,
  onSearch,
  onConfirmPaste,
}: {
  // set while the terminal is open
  xterm: RefObject<Xterm | null>;
  tab: TerminalTab;
  container: RefObject<HTMLDivElement | null>;
  // false while the host key still has to be trusted
  enabled: boolean;
  settings: AppSettings;
  active: boolean;
  focused?: boolean;
  callbacks: SessionCallbacks;
  onSearch: () => void;
  onConfirmPaste: (text: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [phase, setPhase] = useState("Verifica dell’impronta del server");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [details, setDetails] = useState<Record<string, StepNote>>({});
  const [failure, setFailure] = useState("");
  // null until the server asks for a password; the password itself never lives here.
  const [password, setPassword] = useState<PasswordAsk | null>(null);
  const tabRef = useLatest(tab);
  const settingsRef = useLatest(settings);
  const callbacksRef = useLatest(callbacks);
  const handlers = useLatest({
    confirmPaste: onConfirmPaste,
    search: onSearch,
    title: (title?: string) => callbacks.onTitle(tab.id, title),
  });
  useEffect(() => {
    if (xterm.current) applySettings(xterm.current, settings);
  }, [settings]);
  useEffect(() => {
    if (!enabled || !container.current) return;
    setPhase("Avvio della connessione");
    const element = container.current;
    const instance = openXterm(element, settingsRef, handlers);
    xterm.current = instance;
    terminalHandles.set(tab.id, instance.term);
    const observer = new ResizeObserver(instance.refit);
    observer.observe(element);
    const started = performance.now();
    const entry = (text: string) => ({
      text,
      at: Math.round(performance.now() - started),
    });
    const stop = startSession(
      tabRef.current,
      instance,
      {
        status: setPhase,
        log: (text) => setLogs((old) => [...old, entry(text)]),
        detail: (step, text, warn) =>
          setDetails((old) => ({ ...old, [step]: { text, warn } })),
        opened: () => setOpened(true),
        password: (refused) =>
          setPassword((old) => ({
            refused,
            waiting: true,
            asks: (old?.asks ?? 0) + 1,
          })),
        failure: (text, log = true) => {
          setFailure(text);
          if (log) setLogs((old) => [...old, entry(`Errore: ${text}`)]);
        },
      },
      callbacksRef,
    );
    return () => {
      stop();
      observer.disconnect();
      terminalHandles.delete(tab.id);
      instance.dispose();
      xterm.current = null;
    };
  }, [tab.id, enabled]);
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      xterm.current?.fit.fit();
      if (focused !== false) xterm.current?.term.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [active, focused]);
  const submitPassword = (value: string) => {
    setPassword((old) => old && { ...old, waiting: false });
    sendSessionPassword(tab, value).catch((e) =>
      callbacksRef.current.onError(String(e)),
    );
  };
  return { opened, phase, logs, details, failure, password, submitPassword };
}
