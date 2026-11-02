import { useTranslation } from "react-i18next";
import { History, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

const ghostButton = "h-[28px] text-[12px] text-muted-foreground";

// Actions on the selected rows, beside the host group's title; the Esc/arrow handling of the
// search box must not see the buttons, and a click must not take focus from it.
export function LauncherActions({
  busy,
  canCreate,
  restoring,
  onCreate,
  onRestore,
}: {
  busy: boolean;
  canCreate: boolean;
  // how many hosts Ripristina opens; 0 disables it
  restoring: number;
  onCreate: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape and arrow keys from the buttons must not reach the launcher list
    <div
      className="flex gap-[2px]"
      onKeyDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if ((event.target as Element).closest("button")) event.preventDefault();
      }}
    >
      <Button
        variant="ghost"
        type="button"
        className={ghostButton}
        disabled={busy || !canCreate}
        onClick={onCreate}
      >
        <LayoutGrid size={14} />
        {t("terminal.launcherActions.createWorkspace")}
      </Button>
      <Button
        variant="ghost"
        type="button"
        className={ghostButton}
        disabled={busy || !restoring}
        onClick={onRestore}
      >
        <History size={14} />
        {t("terminal.launcherActions.restore")}
        {restoring > 1 ? ` (${restoring})` : ""}
      </Button>
    </div>
  );
}
