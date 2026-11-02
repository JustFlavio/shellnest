import { CommandGroup, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { LauncherResult, ResultGroup } from "./launcher-results.ts";

const groupClass =
  "mb-[18px] rounded-[12px] border border-border bg-card p-[6px] **:[[cmdk-group-heading]]:px-[10px] **:[[cmdk-group-heading]]:py-[9px] **:[[cmdk-group-heading]]:text-[13px] **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:text-foreground";

// The titled result groups of the page in one list. `empty` explains why nothing is listed.
export function LauncherList({
  label,
  multiselectable,
  groups,
  empty,
  renderRow,
  renderActions,
}: {
  label: string;
  // rows can be selected together (Cmd/Ctrl+click, Shift+click)
  multiselectable: boolean;
  groups: ResultGroup[];
  empty: string | null;
  renderRow: (result: LauncherResult, index: number) => React.ReactNode;
  // buttons on the right of a group's title; cmdk hides the title itself from assistive tech
  renderActions?: (group: ResultGroup) => React.ReactNode;
}) {
  const group = (g: ResultGroup) => {
    const actions = renderActions?.(g);
    return (
      <CommandGroup
        key={g.id}
        heading={g.heading}
        className={cn(
          groupClass,
          // the title keeps the height of the 28px buttons beside it
          actions &&
            "relative **:[[cmdk-group-heading]]:flex **:[[cmdk-group-heading]]:min-h-[46px] **:[[cmdk-group-heading]]:items-center",
        )}
      >
        {actions && (
          <div className="absolute top-[15px] right-[16px]">{actions}</div>
        )}
        {g.items.map(({ result, index }) => renderRow(result, index))}
      </CommandGroup>
    );
  };
  return (
    <CommandList
      label={label}
      aria-multiselectable={multiselectable}
      className="max-h-none overflow-visible"
    >
      {groups.map(group)}
      {empty && (
        <p className="mb-[18px] rounded-[12px] border border-border bg-card px-[16px] py-[18px] text-[13px] text-muted-foreground">
          {empty}
        </p>
      )}
    </CommandList>
  );
}
