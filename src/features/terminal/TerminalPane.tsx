import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TerminalTab } from "@/lib/types";
import type { AppSettings } from "@/features/settings/settings.mjs";
import { PaneHeader } from "./PaneHeader";
import { ConnectionTimeline } from "./ConnectionTimeline";
import { PasteConfirmDialog } from "./PasteConfirmDialog";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type { SessionCallbacks } from "./terminal-session";
import { useTerminalSearch } from "./useTerminalSearch";
import { useTerminalSession } from "./useTerminalSession";
import type { Xterm } from "./xterm";

// The standard SSH port is noise: only a different one is worth showing.
function endpointOf(tab: TerminalTab) {
  const target =
    tab.kind === "ssh" ? tab.host : tab.kind === "quick" ? tab.target : null;
  return target
    ? `${tab.username}@${target.address}${target.port === 22 ? "" : `:${target.port}`}`
    : "Shell del dispositivo";
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
) {
  return cn(
    "group/pane absolute z-1 box-border min-h-0 flex-none flex-col bg-background px-[16px] pb-[12px]",
    animate &&
      "transition-[left,top,width,height,opacity] duration-200 ease-out",
    ghost && "pointer-events-none z-0 opacity-0",
    split &&
      "m-[4px] rounded-[12px] border border-border bg-clip-padding px-[10px] pb-[8px]",
    focused && "border-primary",
  );
}

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
  box?: Box;
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
  onClose: () => void;
  onRetry: () => void;
  onEdit?: () => void;
} & SessionCallbacks) {
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const pendingTrust = tab.kind === "ssh" && !tab.host.fingerprint;
  const xterm = useRef<Xterm | null>(null);
  const search = useTerminalSearch(xterm);
  const { opened, phase, logs, failure } = useTerminalSession({
    xterm,
    tab,
    container,
    enabled: !pendingTrust,
    settings,
    active,
    focused,
    callbacks: { onError, onStatus, onTitle, onMetadata },
    onSearch: search.open,
    onConfirmPaste: setPendingPaste,
  });
  const closePasteConfirm = () => {
    setPendingPaste(null);
    xterm.current?.term.focus();
  };
  const endpoint = endpointOf(tab);
  const split = focused !== undefined;
  return (
    <div
      role="group"
      className={paneClass(split, focused, animate, ghost)}
      style={paneStyle(active, box, split)}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      <PaneHeader
        tab={tab}
        endpoint={endpoint}
        split={split}
        onDragPane={onDragPane}
        onClose={onClose}
      />
      <div
        ref={container}
        className="min-h-0 flex-1 [&_.xterm]:h-full"
        style={
          !opened
            ? { position: "absolute", visibility: "hidden", inset: 0 }
            : undefined
        }
      />
      {search.searching && <TerminalSearchBar search={search} />}
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
      {!opened && (
        <ConnectionTimeline
          tab={tab}
          phase={phase}
          logs={logs}
          failure={failure}
          onRetry={onRetry}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}
