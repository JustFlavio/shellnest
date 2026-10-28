import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { describeError } from "@/lib/error-message";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import { createPreviewBackend } from "@/lib/preview";
import { emptyView } from "@/lib/types";
import type { View } from "@/lib/types";
import { useLatest } from "@/lib/useLatest";
import { notifyError } from "@/lib/notify";
import { useVaultStartup } from "./useVaultStartup";

export function useVault() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>(emptyView),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false);
  const busyRef = useRef(false),
    // Bumped whenever the vault is replaced, so results of calls started before are dropped.
    epoch = useRef(0),
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
    return Promise.reject(new Error(t("vault.useVault.startThePreviewFirst")));
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
      throw new Error(t("vault.useVault.theOpenDesktopVersion"));
    setView(next);
  };
  // A failure shows inline in the form or dialog that started it, or as a toast titled `toastTitle` when none is open.
  const run = async (operation: () => Promise<void>, toastTitle?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      if (toastTitle) notifyError(toastTitle, e);
      else setError(describeError(e));
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
      .catch((e) => notifyError(t("vault.useVault.vaultUpdateFailed"), e));
  };
  const startPreview = () =>
    void run(async () => {
      previewBackend.current = createPreviewBackend(
        // `?empty` starts a first-run vault (used by the visual tests).
        new URLSearchParams(location.search).has("empty"),
        // `?fail=a,b` makes those backend commands fail (used by the visual tests).
        new Set(new URLSearchParams(location.search).get("fail")?.split(",")),
      );
      update(await previewBackend.current<View>("status"));
      setPreview(true);
    });
  const opening = useVaultStartup(view, update, setError);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  return {
    view,
    opening,
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
