import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { desktop, mac } from "@/lib/platform";
import { LockKeyhole, Menu, RefreshCw, Settings2 } from "lucide-react";
import { useApp } from "./app-context";

export function AppMenu() {
  const {
    vault: { busy },
    preferences: { hint },
    tabs: { tabs, setPendingClose },
    session: { requestLock },
    settings,
    update,
  } = useApp();
  // On macOS the same actions live in the native menu bar.
  if (mac && desktop) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="mx-[6px] inline-flex size-[30px] shrink-0 items-center justify-center self-center rounded-[9px] border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Menu applicazione"
        title="Menu applicazione"
      >
        <Menu size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-60" aria-label="Menu applicazione">
        <DropdownMenuItem disabled={busy} onClick={() => settings.open()}>
          <Settings2 size={15} />
          Impostazioni
          {hint("openSettings") && (
            <kbd className="ml-auto">{hint("openSettings")}</kbd>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={update.busy} onClick={update.check}>
          <RefreshCw size={15} />
          Controlla aggiornamenti
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || !tabs.length}
          onClick={() => setPendingClose(tabs.map((t) => t.id))}
        >
          Chiudi tutte le sessioni
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onClick={requestLock}>
          <LockKeyhole size={15} />
          Blocca vault
          {hint("lockVault") && (
            <kbd className="ml-auto">{hint("lockVault")}</kbd>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
