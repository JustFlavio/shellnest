import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import type { View } from "@/lib/types";

/** Loads the vault state at launch and reopens a vault whose key is in the system keychain; true while that is going on. */
export function useVaultStartup(
  view: View,
  update: (next: View) => void,
  setError: (error: string) => void,
) {
  const [loading, setLoading] = useState(true),
    [trying, setTrying] = useState(false);
  const triedSaved = useRef(new Set<string>());
  useEffect(() => {
    if (desktop)
      void invoke<View>("status")
        .then(update)
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  // Once per vault and app run (a manual lock stays locked).
  const waitingSaved =
    desktop &&
    !loading &&
    !view.unlocked &&
    view.exists &&
    !triedSaved.current.has(view.vaultId);
  useEffect(() => {
    if (!waitingSaved) return;
    triedSaved.current.add(view.vaultId);
    setTrying(true);
    invoke<View>("unlock_saved", { vaultId: view.vaultId })
      .then(update)
      .catch(() => {})
      .finally(() => setTrying(false));
  }, [waitingSaved, view.vaultId]);
  return loading || trying || waitingSaved;
}
