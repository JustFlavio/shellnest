import { useCloseGuard } from "@/features/terminal/CloseGuard";
import { useLibrary } from "@/features/hosts/useLibrary";
import { usePreferences } from "@/features/settings/usePreferences";
import { useAppUpdate } from "@/features/settings/useAppUpdate";
import { useSettingsDialog } from "@/features/settings/useSettingsDialog";
import { useTabDrag } from "@/features/terminal/useTabDrag";
import { useTabs } from "@/features/terminal/useTabs";
import { useAccount } from "@/features/vault/useAccount";
import { useUnlock } from "@/features/vault/useUnlock";
import { useVault } from "@/features/vault/useVault";
import { useVaultSession } from "@/features/vault/useVaultSession";
import { useVaultSync } from "@/features/vault/useVaultSync";

export function useAppState() {
  const vault = useVault();
  const preferences = usePreferences();
  const closeGuard = useCloseGuard();
  const tabs = useTabs(vault, closeGuard);
  const update = useAppUpdate(
    preferences.appSettings.checkUpdates,
    () =>
      tabs.tabs.some(
        (t) => t.status === "connected" || t.filesStatus === "connected",
      ),
    closeGuard,
  );
  const dnd = useTabDrag(tabs);
  const library = useLibrary(vault, tabs);
  const settings = useSettingsDialog(vault);
  const unlock = useUnlock(vault);
  const sync = useVaultSync(vault, {
    hostSaved: library.hostAutosave.status === "saved",
    canAutoSync: () => !library.editorBlocksSync(anyPanel),
  });
  const session = useVaultSession({
    vault,
    tabs,
    sync,
    hideSettings: settings.hide,
    onReset: () => {
      library.reset();
      unlock.reset();
    },
  });
  const account = useAccount(vault, session.leave);
  const anyPanel = !!(
    library.hostForm ||
    library.groupForm ||
    library.identityForm ||
    library.keyForm ||
    library.bulkOpen ||
    library.deletion ||
    settings.section ||
    (tabs.trust && !tabs.trust.tabId) ||
    tabs.pendingClose ||
    session.vaultDialog ||
    session.pendingSwitch ||
    session.pendingLock ||
    account.form ||
    account.recoveryKey
  );
  return {
    vault,
    preferences,
    closeGuard,
    tabs,
    dnd,
    library,
    settings,
    update,
    unlock,
    sync,
    session,
    account,
    anyPanel,
  };
}

export type AppState = ReturnType<typeof useAppState>;
