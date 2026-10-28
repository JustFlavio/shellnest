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
  if (!syncConfigured) return "Configura sync";
  return lastSync
    ? `Ultima sincronizzazione riuscita: ${lastSync}`
    : "Sincronizza ora";
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
  if (syncState === "syncing") return "Sincronizzazione…";
  if (syncState === "error") return "Sync non riuscita · Riprova";
  if (!syncConfigured) return null;
  if (dirty) return "Da sincronizzare";
  return lastSync ? `Sync ${lastSync}` : "Sync configurata";
}

// `interactive`: the desktop app or the in-memory preview; a plain browser only gets the gate.
export function lockTitle({ exists, restore, interactive }: LockState): string {
  if (exists) return "Sblocca vault";
  if (restore) return "Collega dispositivo";
  return interactive ? "Crea vault locale" : "Esplora Shellnest";
}

export function lockLead({ exists, restore, interactive }: LockState): string {
  if (!interactive)
    return "Client SSH open source per Windows e macOS, con sincronizzazione self-hosted opzionale.";
  if (exists || restore) return "";
  return "Salvato sul dispositivo, cifrato.";
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
  if (busy) return "Attendi…";
  if (exists) return "Sblocca";
  return restore ? "Collega dispositivo" : "Crea vault";
}

// Why the active vault cannot be deleted, or "" when it can.
export function deleteBlock(
  view: Pick<
    View,
    "vaultId" | "hosts" | "identities" | "keys" | "groups" | "workspaces"
  >,
): string {
  if (view.vaultId === "personal")
    return "Il vault Personale non si può eliminare";
  const empty =
    !view.hosts.length &&
    !view.identities.length &&
    !view.keys.length &&
    !view.groups.length &&
    !view.workspaces.length;
  return empty
    ? ""
    : "Svuota prima il vault: host, identità, chiavi e cartelle";
}
