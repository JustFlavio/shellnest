import { History, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

const ghostButton = "h-[28px] text-[12px] text-muted-foreground";

export function LauncherActions({
  busy,
  canCreate,
  session,
  onCreate,
  onRestore,
}: {
  busy: boolean;
  canCreate: boolean;
  session: { count: number } | null;
  onCreate: () => void;
  onRestore: () => void;
}) {
  return (
    <>
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
      {session && (
        <Button
          variant="ghost"
          type="button"
          className={ghostButton}
          disabled={busy}
          title="Riapre le schede dell’ultima sessione su questo dispositivo"
          onClick={onRestore}
        >
          <History size={14} />
          Ripristina ({session.count})
        </Button>
      )}
    </>
  );
}
