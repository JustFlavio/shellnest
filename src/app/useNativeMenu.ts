import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { desktop } from "@/lib/platform";
import { useLatest } from "@/lib/useLatest";
import type { AppState } from "./useAppState";

// Sent by the macOS app menu (src-tauri/src/menu.rs).
const MENU_ACTION_EVENT = "menu-action";

export function useNativeMenu(app: AppState) {
  const latest = useLatest(app);
  const { t, i18n } = useTranslation();
  // The native menu is built in Rust: it gets its texts from here, again whenever the language changes.
  useEffect(() => {
    if (!desktop) return;
    void invoke("set_menu_labels", {
      labels: {
        checkUpdates: `${t("app.appMenu.checkForUpdates")}…`,
        settings: `${t("app.appMenu.settings")}…`,
        vault: t("menu.vault"),
        lockVault: t("vault.vaultPanels.lockVault"),
        closeAllSessions: t("app.appMenu.closeAllSessions"),
        edit: t("menu.edit"),
        window: t("menu.window"),
      },
    });
  }, [t, i18n.language]);
  useEffect(() => {
    if (!desktop) return;
    const unlisten = listen<string>(MENU_ACTION_EVENT, ({ payload }) => {
      const { vault, tabs, settings, session } = latest.current;
      if (!vault.view.unlocked || vault.busyRef.current) return;
      if (payload === "open-settings") settings.open();
      if (payload === "lock-vault") session.requestLock();
      if (payload === "close-all-sessions" && tabs.tabs.length)
        tabs.setPendingClose(tabs.tabs.map((t) => t.id));
    });
    return () => void unlisten.then((off) => off());
  }, [latest]);
}
