import { useEffect } from "react";
import { desktop } from "@/lib/platform";
import type { VaultApi } from "@/features/vault/useVault";
import { parseSession } from "./tabs-state.ts";
import { snapshotSession } from "./workbench-state.ts";
import type { TabList } from "./useTabList";

const sessionKey = (vaultId: string) => `shellnest.session.${vaultId}`;

export function useLastSession({ view }: VaultApi, { tabs, active }: TabList) {
  useEffect(() => {
    if (!desktop || !view.unlocked || !tabs.length) return;
    try {
      const snapshot = snapshotSession(tabs, active);
      if (snapshot.items.length)
        localStorage.setItem(
          sessionKey(view.vaultId),
          JSON.stringify(snapshot),
        );
    } catch {
      // Restoring a session is a convenience; storage may be unavailable.
    }
  }, [tabs, active, view.vaultId, view.unlocked]);
  // The tabs open when the app was last used on this device, minus hosts that no longer exist.
  return () => {
    try {
      return parseSession(
        localStorage.getItem(sessionKey(view.vaultId)),
        new Set(view.hosts.map((h) => h.id)),
      );
    } catch {
      return null;
    }
  };
}
