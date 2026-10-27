import { useEffect, useRef, useState } from "react";
import { useLatest } from "./useLatest";
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  CircleAlert,
  TerminalSquare,
  X,
} from "lucide-react";
import { OsIcon } from "./OsIcon";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { StatusDot } from "./Tab";
import { cn } from "./lib/utils";
import { invoke, Channel, isTauri } from "@tauri-apps/api/core";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { terminalInputChunks } from "./workbench-state.mjs";
import {
  LINE_KILL,
  RESET_MODES,
  WORD_BACK,
  WORD_FORWARD,
  needsPasteConfirm,
  pasteLineCount,
  sanitizePaste,
  terminalKeyAction,
} from "./terminal-input.mjs";
import { Panel } from "./Editors";
import { AlertDialogDescription } from "./components/ui/alert-dialog";
import type { TerminalTab, Output } from "./types";
import "@xterm/xterm/css/xterm.css";
import { help } from "./editor-ui";
import { fontStack, terminalTheme } from "./settings.mjs";
import type { AppSettings } from "./settings.mjs";

const mac = /Mac/i.test(navigator.platform);
// Cmd/Ctrl+click on a link: the system browser (the webview itself must never navigate away).
function openLink(event: MouseEvent, uri: string) {
  if (!(mac ? event.metaKey : event.ctrlKey) || !/^https?:\/\//i.test(uri))
    return;
  if (isTauri()) void invoke("open_url", { url: uri }).catch(() => {});
  else window.open(uri, "_blank", "noopener,noreferrer");
}
// Search highlights (the addon only accepts #RRGGBB).
const searchDecorations = {
  matchBackground: "#5a4311",
  matchOverviewRuler: "#f5a524",
  activeMatchBackground: "#f5a524",
  activeMatchColorOverviewRuler: "#f5a524",
};
// Live terminals by tab id, so global shortcuts can reach the focused one.
export const terminalHandles = new Map<string, Terminal>();
// The browser preview has no backend: tests drive the demo terminals through this.
if (!isTauri())
  (window as unknown as { __terminals: unknown }).__terminals = terminalHandles;
type Status = "connecting" | "connected" | "closed" | "failed";
export function TerminalPane({
  tab,
  active,
  box,
  settings,
  focused,
  ghost,
  animate,
  onFocus,
  onDragPane,
  onError,
  onStatus,
  onTitle,
  onMetadata,
  onClose,
  onRetry,
  onEdit,
}: {
  tab: TerminalTab;
  active: boolean;
  // fractions of the terminals area when the tab is split; undefined = fill
  box?: { x: number; y: number; w: number; h: number };
  settings: AppSettings;
  // undefined when the tab is not split
  focused?: boolean;
  // being dragged away: stays as a faint trace while the others take its place
  ghost?: boolean;
  // glide to a new box (set while panes rearrange, off while resizing by hand)
  animate?: boolean;
  onFocus?: () => void;
  // set when split: the header can be dragged to move the pane
  onDragPane?: (dragging: boolean) => void;
  onError: (error: string) => void;
  onStatus: (id: string, status: Status) => void;
  // title set by the terminal (OSC 0/2); undefined when the session ends
  onTitle: (id: string, title?: string) => void;
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
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [noMatch, setNoMatch] = useState(false);
  const search = useRef<SearchAddon | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const pendingTrust = tab.kind === "ssh" && !tab.host.fingerprint;
  const el = useRef<HTMLDivElement>(null),
    fit = useRef<FitAddon | null>(null),
    terminal = useRef<Terminal | null>(null);
  const refit = useRef<() => void>(() => {});
  const settingsRef = useLatest(settings);
  const callbacks = useLatest({ onError, onStatus, onTitle, onMetadata });
  useEffect(() => {
    const term = terminal.current;
    if (!term) return;
    const o = term.options;
    const family = fontStack(settings.fontFamily);
    const resized = o.fontSize !== settings.fontSize || o.fontFamily !== family;
    o.fontSize = settings.fontSize;
    o.fontFamily = family;
    o.scrollback = settings.scrollback;
    o.macOptionIsMeta = settings.optionAsMeta;
    o.drawBoldTextInBrightColors = settings.brightBold;
    o.theme = { ...terminalTheme(settings.terminalTheme).colors };
    if (resized) refit.current();
  }, [settings]);
  useEffect(() => {
    if (pendingTrust) return;
    setPhase("Avvio della connessione");
    const term = new Terminal({
      fontFamily: fontStack(settingsRef.current.fontFamily),
      fontSize: settingsRef.current.fontSize,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: settingsRef.current.scrollback,
      macOptionIsMeta: settingsRef.current.optionAsMeta,
      drawBoldTextInBrightColors: settingsRef.current.brightBold,
      theme: { ...terminalTheme(settingsRef.current.terminalTheme).colors },
    });
    terminal.current = term;
    terminalHandles.set(tab.id, term);
    const addon = new FitAddon();
    fit.current = addon;
    term.loadAddon(addon);
    term.loadAddon(new WebLinksAddon(openLink));
    // Wide characters and emoji keep the columns aligned.
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = "11";
    const finder = new SearchAddon();
    search.current = finder;
    term.loadAddon(finder);
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
    refit.current = resize;
    // Untrusted clipboard text: strip control characters (ESC could end bracketed paste
    // and run what follows) and confirm big pastes before they reach the shell.
    const paste = (raw: string) => {
      const text = sanitizePaste(raw);
      if (!text) return;
      if (needsPasteConfirm(text)) setPendingPaste(text);
      else term.paste(text);
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      paste(e.clipboardData?.getData("text/plain") ?? "");
    };
    term.element!.addEventListener("paste", onPaste, true);
    const pasteClipboard = () =>
      void navigator.clipboard
        .readText()
        .then(paste)
        .catch(() => {});
    // Right click pastes (there is no context menu on the terminal).
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (settingsRef.current.rightClickPaste) pasteClipboard();
    };
    term.element!.addEventListener("contextmenu", onContextMenu);
    const copied = term.onSelectionChange(() => {
      if (settingsRef.current.copyOnSelect && term.hasSelection())
        void navigator.clipboard.writeText(term.getSelection()).catch(() => {});
    });
    // A short beep; the bell stays silent unless the setting is on.
    const bell = term.onBell(() => {
      if (!settingsRef.current.bell) return;
      try {
        const audio = new AudioContext();
        const osc = audio.createOscillator();
        osc.frequency.value = 880;
        osc.connect(audio.destination);
        osc.start();
        osc.stop(audio.currentTime + 0.08);
        osc.onended = () => void audio.close();
      } catch {}
    });
    // Option stays a normal modifier by default (Italian layouts type @ # [ ] with it):
    // only the arrows are mapped here; macOptionIsMeta is an opt-in setting.
    term.attachCustomKeyEventHandler((e) => {
      const action = terminalKeyAction(e, mac, term.hasSelection());
      if (!action) return true;
      e.preventDefault();
      if (action === "copy")
        void navigator.clipboard.writeText(term.getSelection()).catch(() => {});
      else if (action === "paste") pasteClipboard();
      else if (action === "search") {
        setSearching(true);
        searchInput.current?.focus();
        searchInput.current?.select();
      } else if (action === "line-kill") term.input(LINE_KILL);
      else if (action === "word-back") term.input(WORD_BACK);
      else if (action === "word-forward") term.input(WORD_FORWARD);
      return false;
    });
    // A dead session must not leave bracketed paste, mouse tracking or the alternate screen on.
    const resetModes = () => {
      term.write(RESET_MODES);
      callbacks.current.onTitle(tab.id, undefined);
    };
    const titleChange = term.onTitleChange((title) =>
      callbacks.current.onTitle(
        tab.id,
        title.replace(/[\x00-\x1f\x7f-\x9f]/g, "").slice(0, 100) || undefined,
      ),
    );
    const observer = new ResizeObserver(resize);
    observer.observe(el.current!);
    const input = term.onData((data) => {
      // Typing or pasting is the end of a copy: like every terminal, drop the selection.
      if (term.hasSelection()) term.clearSelection();
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
        resetModes();
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
        resetModes();
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
        copied.dispose();
        bell.dispose();
        titleChange.dispose();
        terminalHandles.delete(tab.id);
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
        resetModes();
        term.writeln(`\r\n\x1b[31m${String(e)}\x1b[0m`);
        callbacks.current.onError(String(e));
      }
    });
    return () => {
      disposed = true;
      observer.disconnect();
      term.element?.removeEventListener("paste", onPaste, true);
      term.element?.removeEventListener("contextmenu", onContextMenu);
      input.dispose();
      copied.dispose();
      bell.dispose();
      titleChange.dispose();
      terminalHandles.delete(tab.id);
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
  const find = (forward: boolean, incremental = false) => {
    if (!query) {
      search.current?.clearDecorations();
      setNoMatch(false);
      return;
    }
    const options = { incremental, decorations: searchDecorations };
    setNoMatch(
      !(forward
        ? search.current?.findNext(query, options)
        : search.current?.findPrevious(query, options)),
    );
  };
  useEffect(() => {
    if (searching) find(true, true);
  }, [query]);
  const closeSearch = () => {
    setSearching(false);
    search.current?.clearDecorations();
    terminal.current?.focus();
  };
  useEffect(() => {
    if (searching) searchInput.current?.focus();
  }, [searching]);
  const statusLabel =
    tab.status === "closed"
      ? "Terminata"
      : tab.status === "failed"
        ? "Non riuscita"
        : tab.status === "connected"
          ? "Connessa"
          : "Connessione…";
  const target =
    tab.kind === "ssh" ? tab.host : tab.kind === "quick" ? tab.target : null;
  // The standard SSH port is noise: only a different one is worth showing.
  const endpoint = target
    ? `${tab.username}@${target.address}${target.port === 22 ? "" : `:${target.port}`}`
    : "Shell del dispositivo";
  return (
    <div
      className={cn(
        "group/pane absolute z-1 box-border min-h-0 flex-none flex-col bg-background px-[16px] pb-[12px]",
        animate &&
          "transition-[left,top,width,height,opacity] duration-200 ease-out",
        ghost && "pointer-events-none z-0 opacity-0",
        focused !== undefined &&
          "m-[4px] rounded-[12px] border border-border bg-clip-padding px-[10px] pb-[8px]",
        focused && "border-primary",
      )}
      style={{
        display: active ? "flex" : "none",
        left: `${(box?.x ?? 0) * 100}%`,
        top: `${(box?.y ?? 0) * 100}%`,
        // A split pane keeps a 4px margin on each side, so the grid leaves 8px between panes.
        width: `calc(${(box?.w ?? 1) * 100}% - ${focused === undefined ? 0 : 8}px)`,
        height: `calc(${(box?.h ?? 1) * 100}% - ${focused === undefined ? 0 : 8}px)`,
      }}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <div className="mt-[2px] mb-[6px] flex h-[34px] shrink-0 items-center gap-[8px] text-[12px] text-muted-foreground">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-[8px]",
            onDragPane && "cursor-grab active:cursor-grabbing",
          )}
          title={onDragPane ? "Trascina per spostare il pannello" : undefined}
          draggable={!!onDragPane}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("application/x-shellnest-pane", tab.id);
            // The pane itself fades out while the others close ranks, so the cursor carries a
            // small card with its name instead of the bare header text.
            const chip = document.createElement("div");
            chip.textContent = tab.title;
            chip.style.cssText =
              "position:fixed;top:-200px;left:-200px;padding:7px 14px;border-radius:10px;" +
              "background:#27221a;border:1px solid #f5a524;color:#f4efe6;font:13px sans-serif;" +
              "box-shadow:0 8px 24px #0008;white-space:nowrap";
            document.body.appendChild(chip);
            e.dataTransfer.setDragImage(chip, 16, 14);
            window.setTimeout(() => chip.remove(), 0);
            onDragPane?.(true);
          }}
          onDragEnd={() => onDragPane?.(false)}
        >
          {tab.kind === "local" ? (
            <TerminalSquare size={14} className="shrink-0" />
          ) : (
            <OsIcon
              size="tab"
              os={tab.kind === "ssh" ? tab.host.os : undefined}
            />
          )}
          <span className="truncate text-[13px] text-foreground">
            {tab.termTitle || tab.title}
          </span>
          {tab.kind !== "local" && (
            <span className="truncate font-mono text-[11px]">{endpoint}</span>
          )}
          <StatusDot status={tab.status ?? "connecting"} className="ml-[2px]" />
          <span className="sr-only">{statusLabel}</span>
        </div>
        {focused !== undefined && (
          <Button
            variant="ghost"
            type="button"
            size="icon-sm"
            className="text-muted-foreground opacity-0 transition-opacity group-focus-within/pane:opacity-100 group-hover/pane:opacity-100"
            aria-label={`Chiudi pannello ${tab.title}`}
            onClick={onClose}
          >
            <X size={15} />
          </Button>
        )}
      </div>
      <div
        ref={el}
        className="min-h-0 flex-1 [&_.xterm]:h-full"
        style={
          !opened
            ? { position: "absolute", visibility: "hidden", inset: 0 }
            : undefined
        }
      />
      {searching && (
        <div
          role="search"
          className="absolute top-[48px] right-[20px] z-10 flex items-center gap-[4px] rounded-[10px] border border-border bg-card p-[4px] shadow-lg"
        >
          <Input
            ref={searchInput}
            value={query}
            placeholder="Cerca nel terminale"
            aria-label="Cerca nel terminale"
            aria-invalid={noMatch || undefined}
            className="h-[30px] w-[200px]"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                closeSearch();
              } else if (e.key === "Enter") {
                e.preventDefault();
                find(!e.shiftKey);
              }
            }}
          />
          <Button
            variant="ghost"
            type="button"
            size="icon-sm"
            aria-label="Risultato precedente"
            onClick={() => find(false)}
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            variant="ghost"
            type="button"
            size="icon-sm"
            aria-label="Risultato successivo"
            onClick={() => find(true)}
          >
            <ChevronDown size={15} />
          </Button>
          <Button
            variant="ghost"
            type="button"
            size="icon-sm"
            aria-label="Chiudi ricerca"
            onClick={closeSearch}
          >
            <X size={15} />
          </Button>
        </div>
      )}
      {pendingPaste !== null && (
        <Panel
          variant="alert"
          title="Incollare più righe?"
          busy={false}
          error=""
          onClose={() => {
            setPendingPaste(null);
            terminal.current?.focus();
          }}
        >
          <AlertDialogDescription>
            Stai per incollare {pasteLineCount(pendingPaste)} righe nel
            terminale. Ogni riga verrà eseguita dalla shell.
          </AlertDialogDescription>
          <pre className="max-h-[160px] overflow-auto rounded-[10px] bg-muted p-[14px] text-left font-mono text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]">
            {pendingPaste.slice(0, 600)}
            {pendingPaste.length > 600 && "…"}
          </pre>
          <footer>
            <Button
              type="button"
              variant="outline"
              data-alert-cancel
              onClick={() => {
                setPendingPaste(null);
                terminal.current?.focus();
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={() => {
                terminal.current?.paste(pendingPaste);
                setPendingPaste(null);
                terminal.current?.focus();
              }}
            >
              Incolla
            </Button>
          </footer>
        </Panel>
      )}
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
            <p className={help}>{endpoint}</p>
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
