import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { LauncherIcon } from "./LauncherIcon";
import type { LauncherResult } from "./launcher-results.ts";
import type { ClickMode } from "./launcher-selection.ts";

// keeps Enter on a row button from reaching the list, which would also run the highlighted result
const stopKey = (event: React.KeyboardEvent) => event.stopPropagation();

export function LauncherRow({
  result,
  cursor,
  selected,
  armed,
  busy,
  onClick,
  onActivate,
  onArmDelete,
  onDelete,
  onNewSession,
}: {
  result: LauncherResult;
  // the row Enter opens
  cursor: boolean;
  // part of the selection: the cursor row, or every marked host
  selected: boolean;
  // a second click on the delete button confirms
  armed: boolean;
  busy: boolean;
  // a single click selects; Cmd/Ctrl toggles, Shift extends a range
  onClick: (mode: ClickMode) => void;
  // double click: same as Enter on the row
  onActivate: () => void;
  onArmDelete: () => void;
  onDelete: () => void;
  onNewSession: () => void;
}) {
  const { t } = useTranslation();
  const open = !!result.openTab;
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- cmdk owns the row's own element and keyboard use goes through the search box; this only adds pointer selection
    <div
      data-launch-selected={cursor ? "" : undefined}
      // keeps focus in the search box so the keys keep working after a click
      onMouseDown={(event) => event.preventDefault()}
      // capture: runs before cmdk's own click handling of the row
      onClickCapture={(event) => {
        if ((event.target as Element).closest("button")) return;
        onClick(
          event.shiftKey
            ? "range"
            : event.metaKey || event.ctrlKey
              ? "toggle"
              : "single",
        );
      }}
      onDoubleClick={(event) => {
        if (
          !(event.target as Element).closest("button") &&
          !(event.shiftKey || event.metaKey || event.ctrlKey)
        )
          onActivate();
      }}
      className={cn(
        "group relative flex items-center rounded-[8px]",
        selected
          ? "bg-[color-mix(in_oklab,var(--primary)_20%,var(--accent))] ring-1 ring-primary/60 ring-inset"
          : "odd:bg-[color-mix(in_oklab,var(--accent)_38%,transparent)] hover:bg-accent",
        cursor && !selected && "ring-1 ring-border ring-inset",
      )}
    >
      <CommandItem
        value={result.key}
        className="h-[42px] min-w-0 flex-1 gap-[11px] rounded-[8px] px-[11px] py-0 text-[13px] data-selected:bg-transparent"
        disabled={busy}
      >
        <LauncherIcon result={result} />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {result.title}
        </span>
        {open && (
          <span className="flex shrink-0 items-center gap-[6px] text-[12px] font-normal text-muted-foreground">
            <span
              className="inline-block size-[5px] rounded-full bg-[#76c5a0]"
              aria-hidden
            />
            aperta
          </span>
        )}
        <span className="shrink-0 text-[12px] font-normal text-muted-foreground">
          {result.path}
        </span>
      </CommandItem>
      {open && (
        <Button
          variant="ghost"
          type="button"
          className="mr-[6px] h-[28px] px-[8px] text-[12px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={t("terminal.launcherRow.newSessionName", {
            name: result.title,
          })}
          title={t("terminal.launcherRow.newSessionShiftEnter")}
          disabled={busy}
          onKeyDown={stopKey}
          onClick={onNewSession}
        >
          <Plus size={14} />
        </Button>
      )}
      {result.workspace && (
        <Button
          variant="ghost"
          type="button"
          className={cn(
            "mr-[6px] h-[28px] px-[8px] text-[12px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            armed && "text-destructive opacity-100",
          )}
          aria-label={t("terminal.launcherRow.deleteWorkspaceName", {
            name: result.title,
          })}
          disabled={busy}
          onKeyDown={stopKey}
          onClick={armed ? onDelete : onArmDelete}
        >
          {armed ? t("terminal.launcherRow.confirm") : <Trash2 size={13} />}
        </Button>
      )}
    </div>
  );
}
