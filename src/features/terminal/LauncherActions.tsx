import { History, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

const ghostButton = "h-[28px] text-[12px] text-muted-foreground";

// Title of the host group with the actions on the selected rows; the Esc/arrow handling of the
// search box must not see the buttons, and a click must not take focus from it.
export function LauncherActions({
  heading,
  busy,
  canCreate,
  restoring,
  onCreate,
  onRestore,
}: {
  heading: string;
  busy: boolean;
  canCreate: boolean;
  // how many hosts Ripristina opens; 0 disables it
  restoring: number;
  onCreate: () => void;
  onRestore: () => void;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape and arrow keys from the buttons must not reach the launcher list
    <div
      className="flex items-center justify-between"
      onKeyDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if ((event.target as Element).closest("button")) event.preventDefault();
      }}
    >
      {heading}
      <span className="flex gap-[2px]">
        <Button
          variant="ghost"
          type="button"
          className={ghostButton}
          disabled={busy || !canCreate}
          onClick={onCreate}
        >
          <LayoutGrid size={14} />
          Crea workspace
        </Button>
        <Button
          variant="ghost"
          type="button"
          className={ghostButton}
          disabled={busy || !restoring}
          onClick={onRestore}
        >
          <History size={14} />
          Ripristina{restoring > 1 ? ` (${restoring})` : ""}
        </Button>
      </span>
    </div>
  );
}
