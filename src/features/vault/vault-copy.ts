import { t } from "../../i18n/i18n.ts";
import type { View } from "../../lib/types.ts";

// Texts that depend on the state of the vault; kept apart from the components that show them.

export type SyncState = "idle" | "syncing" | "error";
type LockState = { exists: boolean; restore: boolean; interactive: boolean };

export function syncTitle({
  syncConfigured,
  lastSync,
}: {
  syncConfigured: boolean;
  lastSync: string;
}): string {
  if (!syncConfigured) return t("vault.vaultCopy.setUpSync");
  return lastSync
    ? t("vault.vaultCopy.lastSyncOk", { time: lastSync })
    : t("vault.syncSettings.syncNow");
}

// null when sync is not set up: only the icon shows.
export function syncLabel({
  syncState,
  syncConfigured,
  dirty,
  lastSync,
}: {
  syncState: SyncState;
  syncConfigured: boolean;
  dirty?: boolean;
  lastSync: string;
}): string | null {
  if (syncState === "syncing") return t("vault.vaultCopy.syncing");
  if (syncState === "error") return t("vault.vaultCopy.syncFailedRetry");
  if (!syncConfigured) return null;
  if (dirty) return t("vault.vaultCopy.toSync");
  return lastSync
    ? t("vault.vaultCopy.syncTime", { time: lastSync })
    : t("vault.vaultCopy.syncSetUp");
}

// `interactive`: the desktop app or the in-memory preview; a plain browser only gets the gate.
export function lockTitle({ exists, restore, interactive }: LockState): string {
  if (exists) return t("vault.vaultCopy.unlockVault");
  if (restore) return t("vault.vaultCopy.connectDevice");
  return interactive
    ? t("vault.vaultCopy.createLocalVault")
    : t("vault.vaultCopy.exploreShellnest");
}

export function lockLead({ exists, restore, interactive }: LockState): string {
  if (!interactive) return t("vault.vaultCopy.openSourceSshClient");
  if (exists || restore) return "";
  return t("vault.vaultCopy.savedOnTheDevice");
}

export function unlockLabel({
  busy,
  exists,
  restore,
}: {
  busy: boolean;
  exists: boolean;
  restore: boolean;
}): string {
  if (busy) return t("vault.vaultCopy.wait");
  if (exists) return t("vault.vaultCopy.unlock");
  return restore
    ? t("vault.vaultCopy.connectDevice")
    : t("vault.vaultPanels.createVault");
}

// Why the active vault cannot be deleted, or "" when it can.
export function deleteBlock(
  view: Pick<
    View,
    "vaultId" | "hosts" | "identities" | "keys" | "groups" | "workspaces"
  >,
): string {
  if (view.vaultId === "personal")
    return t("vault.vaultCopy.theDefaultVaultCannot");
  const empty =
    !view.hosts.length &&
    !view.identities.length &&
    !view.keys.length &&
    !view.groups.length &&
    !view.workspaces.length;
  return empty ? "" : t("vault.vaultCopy.emptyTheVaultFirst");
}
