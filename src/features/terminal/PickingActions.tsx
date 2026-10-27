import { Button } from "@/components/ui/button";
import { MAX_WORKSPACE_HOSTS } from "./launcher-results.ts";

export function PickingActions({
  count,
  busy,
  onCancel,
  onCreate,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <>
      <span className="mr-[8px] text-[12px] text-muted-foreground">
        {count}/{MAX_WORKSPACE_HOSTS}
      </span>
      <Button
        variant="ghost"
        type="button"
        className="h-[28px] text-[12px] text-muted-foreground"
        onClick={onCancel}
      >
        Annulla
      </Button>
      <Button
        variant="default"
        type="button"
        className="h-[28px] text-[12px]"
        disabled={busy || count < 2}
        onClick={onCreate}
      >
        Crea workspace
      </Button>
    </>
  );
}
