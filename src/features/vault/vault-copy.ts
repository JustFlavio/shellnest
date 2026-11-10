import { t } from "../../i18n/i18n.ts";
import type { View } from "../../lib/types.ts";
import type { AccountMode } from "./account-checks.ts";

// Texts that depend on the state of the vault; kept apart from the components that show them.

export type SyncState = "idle" | "syncing" | "error";
// `account`: the account form open on the lock screen, in that mode.
type LockState = {
  exists: boolean;
  account: AccountMode | null;
  interactive: boolean;
};

// `interactive`: the desktop app or the in-memory preview; a plain browser only gets the gate.
export function lockTitle({ exists, account, interactive }: LockState): string {
  if (account === "signIn") return t("vault.vaultCopy.signIn");
  if (account === "register") return t("vault.vaultCopy.createAccount");
  if (account === "recover") return t("vault.vaultCopy.recoverAccount");
  if (exists) return t("vault.vaultCopy.unlockVault");
  return interactive
    ? t("vault.vaultCopy.createLocalVault")
    : t("vault.vaultCopy.exploreShellnest");
}

export function lockLead({ exists, account, interactive }: LockState): string {
  if (!interactive) return t("vault.vaultCopy.openSourceSshClient");
  if (account === "signIn") return t("vault.vaultCopy.signInLead");
  if (account === "register") return t("vault.vaultCopy.registerLead");
  if (account === "recover") return t("vault.vaultCopy.recoverLead");
  if (exists) return "";
  return t("vault.vaultCopy.savedOnTheDevice");
}

export function unlockLabel({
  busy,
  exists,
}: {
  busy: boolean;
  exists: boolean;
}): string {
  if (busy) return t("vault.vaultCopy.wait");
  return exists
    ? t("vault.vaultCopy.unlock")
    : t("vault.vaultPanels.createVault");
}

type DeletableView = Pick<
  View,
  | "vaultId"
  | "hosts"
  | "identities"
  | "keys"
  | "groups"
  | "workspaces"
  | "remote"
>;

/** A member leaves a server vault; its owner, alone in it, deletes it like a local vault. */
export function leavesVault(view: Pick<View, "remote">): boolean {
  return (
    !!view.remote && !(view.remote.role === "owner" && view.remote.members <= 1)
  );
}

// Why the active vault cannot be deleted, or "" when it can.
export function deleteBlock(view: DeletableView): string {
  if (leavesVault(view)) return "";
  if (view.vaultId === "personal" && !view.remote)
    return t("vault.vaultCopy.theDefaultVaultCannot");
  const empty =
    !view.hosts.length &&
    !view.identities.length &&
    !view.keys.length &&
    !view.groups.length &&
    !view.workspaces.length;
  return empty ? "" : t("vault.vaultCopy.emptyTheVaultFirst");
}
