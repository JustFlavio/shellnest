import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { desktop, mac } from "@/lib/platform";
import { LockKeyhole, Menu, RefreshCw, Settings2 } from "lucide-react";
import { useApp } from "./app-context";
import { WithTooltip } from "@/components/WithTooltip";

export function AppMenu() {
  const { t } = useTranslation();
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
      <WithTooltip label={t("app.appMenu.applicationMenu")} side="bottom">
        <DropdownMenuTrigger
          className="mx-[6px] inline-flex size-[30px] shrink-0 items-center justify-center self-center rounded-[9px] border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t("app.appMenu.applicationMenu")}
        >
          <Menu size={18} />
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent
        className="min-w-60"
        aria-label={t("app.appMenu.applicationMenu")}
      >
        <DropdownMenuItem disabled={busy} onClick={() => settings.open()}>
          <Settings2 size={15} />
          {t("app.appMenu.settings")}
          {hint("openSettings") && (
            <DropdownMenuShortcut>{hint("openSettings")}</DropdownMenuShortcut>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={update.busy} onClick={update.check}>
          <RefreshCw size={15} />
          {t("app.appMenu.checkForUpdates")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || !tabs.length}
          onClick={() => setPendingClose(tabs.map((t) => t.id))}
        >
          {t("app.appMenu.closeAllSessions")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onClick={requestLock}>
          <LockKeyhole size={15} />
          {t("vault.vaultPanels.lockVault")}
          {hint("lockVault") && (
            <DropdownMenuShortcut>{hint("lockVault")}</DropdownMenuShortcut>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
