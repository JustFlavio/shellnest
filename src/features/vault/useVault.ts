import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import { createPreviewBackend } from "@/lib/preview";
import { emptyView } from "@/lib/types";
import type { View } from "@/lib/types";
import { useLatest } from "@/lib/useLatest";

/** The open vault: its decrypted view, backend calls, and the busy/error/notice state around them. */
export function useVault() {
  const [view, setView] = useState<View>(emptyView),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false),
    [trying, setTrying] = useState(false);
  const busyRef = useRef(false),
    // Bumped whenever the vault is replaced, so results of calls started before are dropped.
    epoch = useRef(0),
    triedSaved = useRef(new Set<string>()),
    previewBackend = useRef<ReturnType<typeof createPreviewBackend> | null>(
      null,
    );
  const currentVault = useLatest(view.vaultId);
  const invokeCommand = <T>(
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    if (desktop) return invoke<T>(command, args);
    if (previewBackend.current) return previewBackend.current<T>(command, args);
    return Promise.reject(new Error("Avvia prima l'anteprima."));
  };
  const invokeScoped = <T>(
    command: string,
    args: Record<string, unknown> = {},
  ) => invokeCommand<T>(command, { ...args, vaultId: view.vaultId });
  const update = (next: View) => {
    if (
      !Array.isArray(next.keys) ||
      !Array.isArray(next.identities) ||
      !Array.isArray(next.workspaces) ||
      !Array.isArray(next.vaults) ||
      !next.vaultId
    )
      throw new Error(
        "La versione desktop aperta usa ancora il vecchio modello. Chiudi e riavvia l’app aggiornata.",
      );
    setView(next);
  };
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  // Backend metadata (OS, last access) changed while a session ran.
  const refresh = (vaultId: string) => {
    if (vaultId !== currentVault.current) return;
    void invoke<View>("status")
      .then((next) => {
        if (next.vaultId === currentVault.current) update(next);
      })
      .catch((e) => setError(String(e)));
  };
  const startPreview = () =>
    void run(async () => {
      previewBackend.current = createPreviewBackend();
      update(await previewBackend.current<View>("status"));
      setPreview(true);
    });
  useEffect(() => {
    if (desktop)
      void invoke<View>("status")
        .then(update)
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  // Reopens a vault whose key is in the system keychain, once per vault and app run (a manual lock stays locked).
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
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  return {
    view,
    opening: loading || trying || waitingSaved,
    busy,
    setBusy,
    busyRef,
    error,
    setError,
    notice,
    setNotice,
    preview,
    startPreview,
    epoch,
    update,
    run,
    refresh,
    invokeCommand,
    invokeScoped,
  };
}

export type VaultApi = ReturnType<typeof useVault>;
