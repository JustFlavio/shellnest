import { useEffect, useRef, useState } from "react";
import { LoaderCircle, CircleAlert, TerminalSquare } from "lucide-react";
import { Button } from "./components/ui/button";
import { StatusDot } from "./Tab";
import { cn } from "./lib/utils";
import { invoke, Channel, isTauri } from "@tauri-apps/api/core";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { terminalInputChunks } from "./workbench-state.mjs";
import type { TerminalTab, Output } from "./types";
import "@xterm/xterm/css/xterm.css";

type Status = "connecting" | "connected" | "closed" | "failed";
export function TerminalPane({
  tab,
  active,
  box,
  focused,
  onFocus,
  onDragPane,
  onError,
  onStatus,
  onMetadata,
  onClose,
  onRetry,
  onEdit,
}: {
  tab: TerminalTab;
  active: boolean;
  // fractions of the terminals area when the tab is split; undefined = fill
  box?: { x: number; y: number; w: number; h: number };
  // undefined when the tab is not split
  focused?: boolean;
  onFocus?: () => void;
  // set when split: the header can be dragged to move the pane
  onDragPane?: (dragging: boolean) => void;
  onError: (error: string) => void;
  onStatus: (id: string, status: Status) => void;
  onMetadata: (vaultId: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onEdit?: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [phase, setPhase] = useState("Verifica dell’impronta del server");
  const [logs, setLogs] = useState<string[]>([]);
  const [failure, setFailure] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [copyError, setCopyError] = useState("");
  const pendingTrust = tab.kind === "ssh" && !tab.host.fingerprint;
  const el = useRef<HTMLDivElement>(null),
    fit = useRef<FitAddon | null>(null),
    terminal = useRef<Terminal | null>(null);
  const callbacks = useRef({ onError, onStatus, onMetadata });
  callbacks.current = { onError, onStatus, onMetadata };
  useEffect(() => {
    if (pendingTrust) return;
    setPhase("Avvio della connessione");
    const term = new Terminal({
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      theme: {
        background: "#17140f",
        foreground: "#f4efe6",
        cursor: "#f5a524",
        selectionBackground: "#f5a52433",
      },
    });
    terminal.current = term;
    const addon = new FitAddon();
    fit.current = addon;
    term.loadAddon(addon);
    term.open(el.current!);
    addon.fit();
    let disposed = false,
      ready = false,
      failed = false,
      inputQueue = Promise.resolve();
    let pendingInput = "";
    let pendingOverflow = false;
    // The browser preview has no backend: a scripted shell stands in for the session.
    const demo = !isTauri();
    const prompt = `\x1b[32m${tab.kind === "ssh" ? tab.host.username || "root" : "demo"}@${tab.kind === "ssh" ? tab.host.name : "locale"}\x1b[0m:\x1b[34m~\x1b[0m$ `;
    const send = (data: string) => {
      if (demo) {
        term.write(
          data.replace(/\r/g, "\r\n" + prompt).replace(/\x7f/g, "\b \b"),
        );
        return;
      }
      inputQueue = inputQueue
        .then(async () => {
          for (const chunk of terminalInputChunks(data)) {
            if (disposed || !ready) return;
            await invoke("terminal_input", {
              vaultId: tab.vaultId,
              sessionId: tab.id,
              data: chunk,
            });
          }
        })
        .catch((e) => {
          if (!disposed) callbacks.current.onError(String(e));
        });
    };
    const resize = () => {
      if (disposed || !el.current?.offsetWidth) return;
      addon.fit();
      if (ready && !demo)
        void invoke("terminal_resize", {
          vaultId: tab.vaultId,
          sessionId: tab.id,
          cols: term.cols,
          rows: term.rows,
        }).catch(() => {});
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el.current!);
    const input = term.onData((data) => {
      if (ready) send(data);
      else if (!pendingOverflow) {
        if (pendingInput.length + data.length <= 32768) pendingInput += data;
        else {
          pendingOverflow = true;
          pendingInput = "";
          callbacks.current.onError(
            "Input troppo lungo prima della connessione. Attendi il prompt e incolla nuovamente.",
          );
        }
      }
    });
    const handle = (event: Output) => {
      if (disposed) return;
      if (event.type === "data") term.write(new Uint8Array(event.data));
      if (event.type === "status") {
        setPhase(event.data);
        setLogs((old) => [...old, event.data]);
      }
      if (event.type === "status" && event.data === "Connesso") {
        ready = true;
        setOpened(true);
        pendingOverflow = false;
        callbacks.current.onStatus(tab.id, "connected");
        if (pendingInput) {
          send(pendingInput);
          pendingInput = "";
        }
        resize();
        term.focus();
      }
      if (event.type === "metadata") {
        callbacks.current.onMetadata(tab.vaultId);
      }
      if (event.type === "error") {
        failed = true;
        setFailure(event.data);
        setLogs((old) => [...old, event.data]);
        callbacks.current.onStatus(tab.id, "failed");
        term.writeln(`\r\n\x1b[31m${event.data}\x1b[0m`);
        callbacks.current.onError(event.data);
      }
      if (event.type === "closed") {
        if (!ready && !failed) {
          failed = true;
          setFailure("La sessione è terminata prima di aprire il terminale.");
          callbacks.current.onStatus(tab.id, "failed");
        }
        ready = false;
        pendingInput = "";
        if (!failed) callbacks.current.onStatus(tab.id, "closed");
        term.writeln(
          "\r\n\x1b[90mSessione terminata. Usa Riconnetti dal menu della scheda.\x1b[0m",
        );
        void invoke("disconnect", {
          vaultId: tab.vaultId,
          sessionId: tab.id,
        }).catch(() => {});
      }
    };
    if (demo) {
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
        disposed = true;
        timers.forEach(window.clearTimeout);
        observer.disconnect();
        input.dispose();
        term.dispose();
      };
    }
    const output = new Channel<Output>();
    output.onmessage = handle;
    const base = { vaultId: tab.vaultId, sessionId: tab.id, output };
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
        failed = true;
        setFailure(String(e));
        setLogs((old) => [...old, String(e)]);
        callbacks.current.onStatus(tab.id, "failed");
        term.writeln(`\r\n\x1b[31m${String(e)}\x1b[0m`);
        callbacks.current.onError(String(e));
      }
    });
    return () => {
      disposed = true;
      observer.disconnect();
      input.dispose();
      term.dispose();
      void invoke("disconnect", {
        vaultId: tab.vaultId,
        sessionId: tab.id,
      }).catch(() => {});
    };
  }, [tab.id, pendingTrust]);
  useEffect(() => {
    if (active)
      requestAnimationFrame(() => {
        fit.current?.fit();
        if (focused !== false) terminal.current?.focus();
      });
  }, [active, focused]);
  const endpoint =
    tab.kind === "local"
      ? "Shell del dispositivo"
      : `${tab.username}@${tab.kind === "ssh" ? tab.host.address : tab.target.address}:${tab.kind === "ssh" ? tab.host.port : tab.target.port}`;
  return (
    <div
      className={cn(
        "absolute box-border min-h-0 flex-none flex-col bg-background px-[16px] pb-[12px]",
        focused !== undefined &&
          "rounded-[8px] border border-border bg-clip-padding px-[10px] pb-[8px]",
        focused && "border-primary",
      )}
      style={{
        display: active ? "flex" : "none",
        left: `${(box?.x ?? 0) * 100}%`,
        top: `${(box?.y ?? 0) * 100}%`,
        width: `${(box?.w ?? 1) * 100}%`,
        height: `${(box?.h ?? 1) * 100}%`,
      }}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <div
        className="mb-[8px] flex h-[38px] shrink-0 items-center gap-[9px] border-b border-border font-mono text-[12px] text-muted-foreground [&>span:last-child]:ml-auto"
        draggable={!!onDragPane}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-server-manager-pane", tab.id);
          onDragPane?.(true);
        }}
        onDragEnd={() => onDragPane?.(false)}
      >
        <StatusDot status={tab.status ?? "connecting"} />
        {endpoint}
        <span>
          {tab.kind === "local" ? "PTY locale" : tab.identityName} ·{" "}
          {tab.status === "closed"
            ? "Terminata"
            : tab.status === "failed"
              ? "Non riuscita"
              : tab.status === "connected"
                ? "Connessa"
                : "Connessione…"}
        </span>
      </div>
      <div
        ref={el}
        className="min-h-0 flex-1"
        style={
          !opened
            ? { position: "absolute", visibility: "hidden", inset: 0 }
            : undefined
        }
      />
      {!opened && (
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-[24px]">
          <div className="w-[min(100%,460px)] text-center [&>h2]:text-[18px] [&>h2]:font-semibold [&>p]:my-[10px] [&>p]:[overflow-wrap:anywhere] [&>svg]:mx-auto [&>svg]:mb-[16px] [&>svg]:text-primary">
            {failure || tab.error ? (
              <CircleAlert size={32} />
            ) : pendingTrust ? (
              <TerminalSquare size={32} />
            ) : (
              <LoaderCircle size={32} className="animate-spin" />
            )}
            <h2>{tab.title}</h2>
            <p className="help">{endpoint}</p>
            <p role={failure || tab.error ? "alert" : "status"}>
              {failure || tab.error || phase}
            </p>
            <Button variant="ghost" onClick={() => setShowLogs(!showLogs)}>
              {showLogs ? "Nascondi dettagli" : "Mostra dettagli"}
            </Button>
            {showLogs && (
              <pre className="max-h-[240px] overflow-auto rounded-[10px] bg-muted p-[14px] text-left text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]">
                {[...logs, ...(tab.error ? [tab.error] : [])].join("\n") ||
                  phase}
              </pre>
            )}
            <div className="mt-[20px] flex flex-wrap justify-center gap-[8px]">
              <Button variant="outline" onClick={onClose}>
                Chiudi
              </Button>
              {(failure || tab.error) && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(
                          [...logs, ...(tab.error ? [tab.error] : [])].join(
                            "\n",
                          ),
                        )
                        .catch(() => setCopyError("Copia non riuscita."))
                    }
                  >
                    Copia log
                  </Button>
                  {onEdit && (
                    <Button variant="outline" onClick={onEdit}>
                      Modifica host
                    </Button>
                  )}
                  <Button onClick={onRetry}>Riprova</Button>
                </>
              )}
            </div>
            {copyError && <p role="alert">{copyError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
