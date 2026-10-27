import { CommandGroup, CommandList } from "@/components/ui/command";
import type { LauncherResult, ResultGroup } from "./launcher-results.ts";

const groupClass =
  "mb-[18px] rounded-[12px] border border-border bg-card p-[6px] **:[[cmdk-group-heading]]:px-[10px] **:[[cmdk-group-heading]]:py-[9px] **:[[cmdk-group-heading]]:text-[13px] **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:text-foreground";

// The titled result groups in one list, so the arrow keys walk across them. `empty` explains
// why no tab or host is listed; it sits where those groups would be, before quick connect.
export function LauncherList({
  label,
  groups,
  empty,
  renderRow,
}: {
  label: string;
  groups: ResultGroup[];
  empty: string | null;
  renderRow: (result: LauncherResult, index: number) => React.ReactNode;
}) {
  const group = ({ id, heading, items }: ResultGroup) => (
    <CommandGroup key={id} heading={heading} className={groupClass}>
      {items.map(({ result, index }) => renderRow(result, index))}
    </CommandGroup>
  );
  return (
    <CommandList label={label} className="max-h-none overflow-visible">
      {groups.filter((g) => g.id !== "quick").map(group)}
      {empty && (
        <p className="mb-[18px] rounded-[12px] border border-border bg-card px-[16px] py-[18px] text-[13px] text-muted-foreground">
          {empty}
        </p>
      )}
      {groups.filter((g) => g.id === "quick").map(group)}
    </CommandList>
  );
}
