import { useApp } from "@/app/app-context";
import { SftpWorkspace } from "@/features/sftp/SftpWorkspace";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TFunction } from "i18next";
import type { TerminalTab } from "@/lib/types";
import type { AppSettings } from "@/features/settings/settings.ts";
import { PaneHeader } from "./PaneHeader";
import { ConnectionTimeline } from "./ConnectionTimeline";
import { PasteConfirmDialog } from "./PasteConfirmDialog";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type { SessionCallbacks } from "./terminal-session";
import { useTerminalSearch } from "./useTerminalSearch";
import { useTerminalSession } from "./useTerminalSession";
import type { Xterm } from "./xterm";

// The standard SSH port is noise: only a different one is worth showing.
function endpointOf(tab: TerminalTab, t: TFunction) {
  const target =
    tab.kind === "ssh" ? tab.host : tab.kind === "quick" ? tab.target : null;
  return target
    ? `${tab.username ? `${tab.username}@` : ""}${target.address}${target.port === 22 ? "" : `:${target.port}`}`
    : t("terminal.terminalPane.deviceShell");
}

type Box = { x: number; y: number; w: number; h: number };

// A split pane keeps a 4px margin on each side, so the grid leaves 8px between panes.
function paneStyle(active: boolean, box: Box | undefined, split: boolean) {
  const { x, y, w, h } = box ?? { x: 0, y: 0, w: 1, h: 1 };
  const margin = split ? 8 : 0;
  return {
    display: active ? "flex" : "none",
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `calc(${w * 100}% - ${margin}px)`,
    height: `calc(${h * 100}% - ${margin}px)`,
  };
}

function paneClass(
  split: boolean,
  focused: boolean | undefined,
  animate: boolean | undefined,
  ghost: boolean | undefined,
  broadcast: boolean,
) {
  return cn(
    "group/pane absolute z-1 box-border min-h-0 flex-none flex-col bg-background px-[16px] pb-[12px]",
    animate &&
      "transition-[left,top,width,height,opacity] duration-200 ease-out",
    ghost && "pointer-events-none z-0 opacity-0",
    split &&
      "m-[4px] rounded-[12px] border border-border bg-clip-padding px-[10px] pb-[8px]",
    // dashed on every pane of the workspace, so it is plain that typing reaches all of them
    broadcast && "border-dashed border-primary/60",
    focused && "border-primary",
  );
}

export function TerminalPane({
  tab,
  active,
  box,
  settings,
  focused,
  broadcast = false,
  ghost,
  animate,
  onFocus,
  onToggleBroadcast,
  onDragPane,
  onError,
  onStatus,
  onTitle,
  onMetadata,
  onClose,
  onRetry,
  onReconnect,
  onEdit,
}: {
  tab: TerminalTab;
  active: boolean;
  // fractions of the terminals area when the tab is split; undefined = fill
  box?: Box;
  settings: AppSettings;
  // undefined when the tab is not split
  focused?: boolean;
  // the workspace sends typed input to all its panes
  broadcast?: boolean;
  onToggleBroadcast?: () => void;
  // being dragged away: stays as a faint trace while the others take its place
  ghost?: boolean;
  // glide to a new box (set while panes rearrange, off while resizing by hand)
  animate?: boolean;
  onFocus?: () => void;
  // set when split: the header can be dragged to move the pane
  onDragPane?: (dragging: boolean) => void;
  onClose: () => void;
  onRetry: () => void;
  onReconnect: () => void;
  onEdit?: () => void;
} & SessionCallbacks) {
  const { t } = useTranslation();
  const { tabs, closeGuard } = useApp();
  const files = tab.view === "files";
  const [filesStarted, setFilesStarted] = useState(tab.initialView === "files");
  const [terminalStarted, setTerminalStarted] = useState(
    tab.initialView !== "files",
  );
  if (files && !filesStarted) setFilesStarted(true);
  if (!files && !terminalStarted) setTerminalStarted(true);
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  // No session until the host key is confirmed (and, for a quick connection, the login chosen).
  const pendingTrust =
    (tab.kind === "ssh" && !tab.host.fingerprint) ||
    (tab.kind === "quick" && !tab.target.expectedFingerprint);
  const xterm = useRef<Xterm | null>(null);
  const search = useTerminalSearch(xterm);
  const { opened, phase, logs, details, failure, password, submitPassword } =
    useTerminalSession({
      xterm,
      onOpen: (instance) => {
        xterm.current = instance;
      },
      tab,
      container,
      enabled: !pendingTrust && terminalStarted,
      settings,
      active: active && !files,
      focused,
      callbacks: { onError, onStatus, onTitle, onMetadata },
      onSearch: search.open,
      onConfirmPaste: setPendingPaste,
    });
  const closePasteConfirm = () => {
    setPendingPaste(null);
    xterm.current?.term.focus();
  };
  const endpoint = endpointOf(tab, t);
  const split = focused !== undefined;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- focus follows pointer and focus anywhere inside the pane
    <div
      role="group"
      className={paneClass(split, focused, animate, ghost, broadcast)}
      style={paneStyle(active, box, split)}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <PaneHeader
        tab={tab}
        endpoint={endpoint}
        split={split}
        broadcast={broadcast}
        onToggleBroadcast={onToggleBroadcast}
        onDragPane={onDragPane}
        onClose={onClose}
        onReconnect={() =>
          closeGuard.ask(tab.filesStatus === "connected", onReconnect)
        }
      />
      {tab.kind !== "local" && (
        <div
          className="mb-2 flex shrink-0 gap-1"
          role="group"
          aria-label={t("sftp.view")}
        >
          <Button
            size="sm"
            variant={files ? "ghost" : "secondary"}
            aria-pressed={!files}
            onClick={() => tabs.setPaneView(tab.id, "terminal")}
          >
            {t("sftp.terminal")}
          </Button>
          <Button
            size="sm"
            variant={files ? "secondary" : "ghost"}
            aria-pressed={files}
            onClick={() => tabs.setPaneView(tab.id, "files")}
          >
            {t("sftp.files")}
          </Button>
        </div>
      )}
      {filesStarted && !pendingTrust && (
        <div
          className="min-h-0 flex-1 flex-col"
          style={{ display: files ? "flex" : "none" }}
        >
          <SftpWorkspace tab={tab} />
        </div>
      )}
      <div
        ref={container}
        className="min-h-0 flex-1 [&_.xterm]:h-full"
        style={
          !opened || files
            ? { position: "absolute", visibility: "hidden", inset: 0 }
            : undefined
        }
      />
      {!files && search.searching && <TerminalSearchBar search={search} />}
      {pendingPaste !== null && (
        <PasteConfirmDialog
          text={pendingPaste}
          onCancel={closePasteConfirm}
          onConfirm={() => {
            xterm.current?.term.paste(pendingPaste);
            closePasteConfirm();
          }}
        />
      )}
      {!opened && (!files || pendingTrust) && (
        <ConnectionTimeline
          tab={tab}
          phase={phase}
          logs={logs}
          details={details}
          failure={failure}
          password={password}
          onPassword={submitPassword}
          onCancel={onClose}
          onRetry={() =>
            closeGuard.ask(tab.filesStatus === "connected", onRetry)
          }
          onEdit={onEdit}
        />
      )}
    </div>
  );
}
