import type { View } from "@/lib/types";

export type SyncState = "idle" | "syncing" | "error";
export function syncTitle(state: {
  syncConfigured: boolean;
  lastSync: string;
}): string;
export function syncLabel(state: {
  syncState: SyncState;
  syncConfigured: boolean;
  dirty?: boolean;
  lastSync: string;
}): string | null;
type LockState = { exists: boolean; restore: boolean; interactive: boolean };
export function lockTitle(state: LockState): string;
export function lockLead(state: LockState): string;
export function unlockLabel(state: {
  busy: boolean;
  exists: boolean;
  restore: boolean;
}): string;
export function deleteBlock(
  view: Pick<
    View,
    "vaultId" | "hosts" | "identities" | "keys" | "groups" | "workspaces"
  >,
): string;
