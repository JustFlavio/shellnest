import { useCloseGuard } from "./CloseGuard";
import { useLibrary } from "./useLibrary";
import { usePreferences } from "./usePreferences";
import { useSettingsDialog } from "./useSettingsDialog";
import { useTabDrag } from "./useTabDrag";
import { useTabs } from "./useTabs";
import { useUnlock } from "./useUnlock";
import { useVault } from "./useVault";
import { useVaultSession } from "./useVaultSession";
import { useVaultSync } from "./useVaultSync";

/** Every piece of app state, wired together; components read it through useApp(). */
export function useAppState() {
  const vault = useVault();
  const preferences = usePreferences();
  const closeGuard = useCloseGuard();
  const tabs = useTabs(vault, closeGuard);
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
      settings.clearToken();
    },
  });
  const anyPanel = !!(
    library.hostForm ||
    library.groupForm ||
    library.identityForm ||
    library.keyForm ||
    library.bulkOpen ||
    library.deletion ||
    settings.section ||
    tabs.trust ||
    tabs.pendingClose ||
    session.vaultDialog ||
    session.pendingSwitch ||
    session.pendingLock
  );
  return {
    vault,
    preferences,
    closeGuard,
    tabs,
    dnd,
    library,
    settings,
    unlock,
    sync,
    session,
    anyPanel,
  };
}

export type AppState = ReturnType<typeof useAppState>;
