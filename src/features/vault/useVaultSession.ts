import { useState } from "react";
import type { View } from "@/lib/types";
import type { TabsApi } from "@/features/terminal/useTabs";
import type { VaultApi } from "./useVault";

type SessionDeps = {
  vault: VaultApi;
  tabs: TabsApi;
  sync: { reset: () => void };
  hideSettings: () => void;
  // Everything else tied to the vault being left: selection, filters, open editors, unlock form.
  onReset: () => void;
};

export function useVaultSession({
  vault,
  tabs,
  sync,
  hideSettings,
  onReset,
}: SessionDeps) {
  const { view, run, update, invokeCommand, invokeScoped, epoch } = vault;
  const [vaultDialog, setVaultDialog] = useState<{
      mode: "create" | "rename";
      name: string;
    } | null>(null),
    [pendingSwitch, setPendingSwitch] = useState<string | null>(null),
    [pendingLock, setPendingLock] = useState(false);
  const leave = (next: View) => {
    update(next);
    tabs.reset();
    sync.reset();
    vault.setNotice("");
    setPendingSwitch(null);
    setVaultDialog(null);
    onReset();
  };
  // Asked from a confirmation dialog the failure shows in it; from the menu or switcher directly, as a toast.
  const switchVault = (id: string) =>
    void run(
      async () => {
        epoch.current++;
        leave(await invokeCommand<View>("select_vault", { vaultId: id }));
      },
      pendingSwitch ? undefined : "Cambio vault non riuscito",
    );
  const lockVault = () =>
    void run(
      async () => {
        epoch.current++;
        leave(await invokeScoped<View>("lock"));
        setPendingLock(false);
      },
      pendingLock ? undefined : "Blocco del vault non riuscito",
    );
  const deleteVault = () =>
    void run(async () => {
      epoch.current++;
      hideSettings();
      leave(await invokeScoped<View>("delete_vault"));
    });
  const submitVaultDialog = () => {
    if (!vaultDialog) return;
    void run(async () => {
      if (vaultDialog.mode === "create") {
        epoch.current++;
        leave(
          await invokeScoped<View>("create_vault", { name: vaultDialog.name }),
        );
      } else {
        update(
          await invokeCommand<View>("rename_vault", {
            vaultId: view.vaultId,
            name: vaultDialog.name,
          }),
        );
        setVaultDialog(null);
      }
    });
  };
  const requestSwitch = (id: string) => {
    if (id === view.vaultId) return;
    if (tabs.tabs.length) {
      setPendingSwitch(id);
      vault.setError("");
    } else switchVault(id);
  };
  const requestLock = () =>
    tabs.tabs.length ? setPendingLock(true) : lockVault();
  const openCreateDialog = () => {
    vault.setError("");
    setVaultDialog({ mode: "create", name: "" });
  };
  const openRenameDialog = () => {
    vault.setError("");
    setVaultDialog({ mode: "rename", name: view.vaultName });
  };
  return {
    vaultDialog,
    setVaultDialog,
    submitVaultDialog,
    openCreateDialog,
    openRenameDialog,
    pendingSwitch,
    setPendingSwitch,
    pendingLock,
    setPendingLock,
    switchVault,
    lockVault,
    deleteVault,
    requestSwitch,
    requestLock,
  };
}
