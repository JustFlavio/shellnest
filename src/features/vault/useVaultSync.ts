import { useEffect, useRef, useState } from "react";
import { desktop } from "@/lib/platform";
import type { View } from "@/lib/types";
import { useLatest } from "@/lib/useLatest";
import type { VaultApi } from "./useVault";

type SyncOptions = {
  // A host edit has just been saved and is waiting to go out.
  hostSaved: boolean;
  // Background syncs wait while an editor holds unsaved or invalid input.
  canAutoSync: () => boolean;
};

/** Optional self-hosted sync: manual, after a save, and every 30 seconds. */
export function useVaultSync(
  {
    view,
    busy,
    busyRef,
    epoch,
    setBusy,
    setError,
    setNotice,
    update,
    invokeScoped,
  }: VaultApi,
  { hostSaved, canAutoSync }: SyncOptions,
) {
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">(
      "idle",
    ),
    [lastSync, setLastSync] = useState("");
  const syncing = useRef(false);
  const canAuto = useLatest(canAutoSync);
  const synchronize = async (manual = false) => {
    if (!manual && !canAuto.current()) return;
    if (syncing.current || busyRef.current) return;
    syncing.current = true;
    if (manual) {
      busyRef.current = true;
      setBusy(true);
    }
    setSyncState("syncing");
    const generation = epoch.current;
    let failed = false;
    try {
      const next = await invokeScoped<View>("sync_vault");
      if (generation !== epoch.current) return;
      update(next);
      setLastSync(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      if (manual) setNotice("Vault sincronizzato");
    } catch (e) {
      failed = true;
      if (generation === epoch.current) setError(String(e));
    } finally {
      syncing.current = false;
      if (generation === epoch.current) setSyncState(failed ? "error" : "idle");
      if (manual) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  const latest = useLatest(synchronize);
  useEffect(() => {
    if (
      !desktop ||
      !view.unlocked ||
      !view.syncConfigured ||
      !view.dirty ||
      !hostSaved ||
      busy
    )
      return;
    const timer = setTimeout(() => void latest.current(), 400);
    return () => clearTimeout(timer);
  }, [hostSaved, view.dirty, view.syncConfigured, view.vaultId, busy]);
  useEffect(() => {
    if (!desktop || !view.unlocked || !view.syncConfigured) return;
    const timer = setInterval(() => void latest.current(), 30000);
    return () => clearInterval(timer);
  }, [view.unlocked, view.syncConfigured, view.vaultId]);
  const reset = () => {
    setLastSync("");
    setSyncState("idle");
  };
  return { synchronize, syncState, lastSync, reset };
}
