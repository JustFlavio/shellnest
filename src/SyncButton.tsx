import { Button } from "./components/ui/button";
import { Cloud, RefreshCw } from "lucide-react";
import { useApp } from "./app-context";

export function SyncButton() {
  const {
    vault: { view, busy, preview },
    sync: { synchronize, syncState, lastSync },
    settings,
  } = useApp();
  return (
    <Button
      variant="ghost"
      type="button"
      className="h-[28px] shrink-0 gap-[6px] px-[8px] text-[12px] text-muted-foreground disabled:opacity-70 max-[760px]:hidden"
      title={
        view.syncConfigured
          ? lastSync
            ? `Ultima sincronizzazione riuscita: ${lastSync}`
            : "Sincronizza ora"
          : "Configura il tuo servizio di sincronizzazione"
      }
      disabled={busy || syncState === "syncing" || preview}
      onClick={() => {
        if (view.syncConfigured) void synchronize(true);
        else settings.open("vault");
      }}
      aria-live="polite"
    >
      {syncState === "syncing" ? <RefreshCw size={14} /> : <Cloud size={14} />}
      {syncState === "syncing"
        ? "Sincronizzazione…"
        : syncState === "error"
          ? "Sync non riuscita · Riprova"
          : view.syncConfigured
            ? view.dirty
              ? "Da sincronizzare"
              : lastSync
                ? `Sync ${lastSync}`
                : "Sync configurata"
            : null}
    </Button>
  );
}
