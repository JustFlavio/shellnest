import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { desktop } from "@/lib/platform";
import { useLatest } from "@/lib/useLatest";
import type { AppState } from "./useAppState";

// Sent by the macOS app menu (src-tauri/src/menu.rs).
const MENU_ACTION_EVENT = "menu-action";

export function useNativeMenu(app: AppState) {
  const latest = useLatest(app);
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
