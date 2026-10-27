import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { desktop } from "@/lib/platform";
import { notifyError } from "@/lib/notify";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  KeyRound,
  LockKeyhole,
  Menu,
  Plus,
  Server,
  Settings2,
  TerminalSquare,
  UserRound,
} from "lucide-react";
import { useApp } from "./app-context";

const onWindowError = (e: unknown) =>
  notifyError("Operazione sulla finestra non riuscita", e);

export function AppMenu() {
  const {
    vault: { busy },
    preferences: { hint },
    tabs: { tabs, setPendingClose, openLauncher, openLocal },
    library: { group, navigate, newHostIn },
    session: { requestLock },
    settings,
  } = useApp();
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
        <DropdownMenuItem onClick={() => navigate("hosts")}>
          <Server size={15} />
          Host e cartelle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("identities")}>
          <UserRound size={15} />
          Identità
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("keys")}>
          <KeyRound size={15} />
          Chiavi SSH
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onClick={() => newHostIn(group)}>
          <Plus size={15} />
          Nuovo host
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={openLauncher}>
          <Plus size={15} />
          Nuova tab {hint("quickConnect") && <kbd>{hint("quickConnect")}</kbd>}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={openLocal}>
          <TerminalSquare size={15} />
          Terminale locale
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onClick={() => settings.open()}>
          <Settings2 size={15} />
          Impostazioni
          {hint("openSettings") && (
            <kbd className="ml-auto">{hint("openSettings")}</kbd>
          )}
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
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!desktop}
          onClick={() =>
            void getCurrentWindow().minimize().catch(onWindowError)
          }
        >
          Riduci a icona
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!desktop}
          onClick={() =>
            void getCurrentWindow().toggleMaximize().catch(onWindowError)
          }
        >
          Massimizza / ripristina finestra
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!desktop || busy}
          onClick={() => void getCurrentWindow().close().catch(onWindowError)}
        >
          Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
