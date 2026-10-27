import { Check, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandItem } from "@/components/ui/command";
import { OsIcon } from "@/components/OsIcon";
import { cn } from "@/lib/utils";
import type { LauncherResult } from "./launcher-results.mjs";

// keeps Enter on a row button from reaching the list, which would also run the highlighted result
const stopKey = (event: React.KeyboardEvent) => event.stopPropagation();

export function LauncherRow({
  result,
  selected,
  checked,
  armed,
  busy,
  onActivate,
  onArmDelete,
  onDelete,
  onNewSession,
}: {
  result: LauncherResult;
  selected: boolean;
  // undefined unless hosts are being picked for a workspace
  checked?: boolean;
  // a second click on the delete button confirms
  armed: boolean;
  busy: boolean;
  onActivate: () => void;
  onArmDelete: () => void;
  onDelete: () => void;
  onNewSession: () => void;
}) {
  const open = !!result.openTab && checked === undefined;
  return (
    <div
      data-launch-selected={selected ? "" : undefined}
      className={cn(
        "group relative flex items-center rounded-[8px]",
        selected
          ? "bg-accent"
          : "odd:bg-[color-mix(in_oklab,var(--accent)_38%,transparent)]",
      )}
    >
      <CommandItem
        value={result.key}
        className="h-[42px] min-w-0 flex-1 gap-[11px] rounded-[8px] px-[11px] py-0 text-[13px] data-selected:bg-transparent"
        aria-checked={checked}
        disabled={busy}
        onSelect={onActivate}
      >
        {checked !== undefined && (
          <span
            className={cn(
              "grid size-[16px] shrink-0 place-items-center rounded-[4px] border border-input text-primary-foreground",
              checked && "border-primary bg-primary",
            )}
            aria-hidden
          >
            {checked && <Check size={11} />}
          </span>
        )}
        {result.kind === "workspace" ? (
          <span className="grid size-[24px] shrink-0 place-items-center rounded-[6px] bg-[color-mix(in_oklab,#76c5a0_16%,transparent)] text-[#76c5a0]">
            <LayoutGrid size={14} />
          </span>
        ) : (
          <OsIcon os={result.os} size="launch" />
        )}
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
          aria-label={`Nuova sessione ${result.title}`}
          title="Nuova sessione (Maiusc+Invio)"
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
          aria-label={`Elimina workspace ${result.title}`}
          disabled={busy}
          onKeyDown={stopKey}
          onClick={armed ? onDelete : onArmDelete}
        >
          {armed ? "Conferma" : <Trash2 size={13} />}
        </Button>
      )}
    </div>
  );
}
