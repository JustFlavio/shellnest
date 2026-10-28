import { useEffect, useState } from "react";
import { describeError } from "@/lib/error-message";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import type { View } from "@/lib/types";
import { useLatest } from "@/lib/useLatest";

/** Loads the vault state at launch and reopens a vault whose key is in the system keychain; true while that is going on. */
export function useVaultStartup(
  view: View,
  update: (next: View) => void,
  setError: (error: string) => void,
) {
  const [loading, setLoading] = useState(desktop),
    [triedSaved, setTriedSaved] = useState<readonly string[]>([]);
  const latest = useLatest({ update, setError });
  useEffect(() => {
    if (!desktop) return;
    void invoke<View>("status")
      .then((next) => latest.current.update(next))
      .catch((e) => latest.current.setError(describeError(e)))
      .finally(() => setLoading(false));
  }, [latest]);
  // Once per vault and app run (a manual lock stays locked); stays true while the attempt runs.
  const waitingSaved =
    desktop &&
    !loading &&
    !view.unlocked &&
    view.exists &&
    !triedSaved.includes(view.vaultId);
  useEffect(() => {
    if (!waitingSaved) return;
    const vaultId = view.vaultId;
    invoke<View>("unlock_saved", { vaultId })
      .then((next) => latest.current.update(next))
      .catch(() => {})
      .finally(() => setTriedSaved((old) => [...old, vaultId]));
  }, [waitingSaved, view.vaultId, latest]);
  return loading || waitingSaved;
}
