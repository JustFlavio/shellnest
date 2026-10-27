import { Button } from "@/components/ui/button";
import { Cloud, RefreshCw } from "lucide-react";
import { useApp } from "@/app/app-context";
import { syncLabel, syncTitle } from "./vault-copy.mjs";

export function SyncButton() {
  const {
    vault: { view, busy, preview },
    sync: { synchronize, syncState, lastSync },
    settings,
  } = useApp();
  const Icon = syncState === "syncing" ? RefreshCw : Cloud;
  return (
    <Button
      variant="ghost"
      type="button"
      className="h-[28px] shrink-0 gap-[6px] px-[8px] text-[12px] text-muted-foreground disabled:opacity-70 max-[760px]:hidden"
      title={syncTitle({ syncConfigured: view.syncConfigured, lastSync })}
      disabled={busy || syncState === "syncing" || preview}
      onClick={() => {
        if (view.syncConfigured) void synchronize(true);
        else settings.open("vault");
      }}
      aria-live="polite"
    >
      <Icon size={14} />
      {syncLabel({
        syncState,
        syncConfigured: view.syncConfigured,
        dirty: view.dirty,
        lastSync,
      })}
    </Button>
  );
}
