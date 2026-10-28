import { TerminalSquare, X } from "lucide-react";
import { OsIcon } from "@/components/OsIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TerminalTab } from "@/lib/types";
import { StatusDot } from "./Tab";

const statusLabel = {
  connecting: "Connessione…",
  connected: "Connessa",
  closed: "Terminata",
  failed: "Non riuscita",
};

// The pane itself fades out while the others close ranks, so the cursor carries a
// small card with its name instead of the bare header text.
function startPaneDrag(event: React.DragEvent, tab: TerminalTab) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-shellnest-pane", tab.id);
  const chip = document.createElement("div");
  chip.textContent = tab.title;
  chip.style.cssText =
    "position:fixed;top:-200px;left:-200px;padding:7px 14px;border-radius:10px;" +
    "background:#27221a;border:1px solid #f5a524;color:#f4efe6;font:13px sans-serif;" +
    "box-shadow:0 8px 24px #0008;white-space:nowrap";
  document.body.appendChild(chip);
  event.dataTransfer.setDragImage(chip, 16, 14);
  window.setTimeout(() => chip.remove(), 0);
}

export function PaneHeader({
  tab,
  endpoint,
  split,
  onDragPane,
  onClose,
}: {
  tab: TerminalTab;
  endpoint: string;
  split: boolean;
  // set when split: the header can be dragged to move the pane
  onDragPane?: (dragging: boolean) => void;
  onClose: () => void;
}) {
  const status = tab.status ?? "connecting";
  return (
    <div className="mt-[2px] mb-[6px] flex h-[34px] shrink-0 items-center gap-[8px] text-[12px] text-muted-foreground">
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-[8px]",
          onDragPane && "cursor-grab active:cursor-grabbing",
        )}
        draggable={!!onDragPane}
        onDragStart={(e) => {
          startPaneDrag(e, tab);
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
        <StatusDot status={status} className="ml-[2px]" />
        <span className="sr-only">{statusLabel[status]}</span>
      </div>
      {split && (
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
  );
}
