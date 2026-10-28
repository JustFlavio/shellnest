import { useState } from "react";
import type { Page } from "./useCollectionView";
import type { VaultApi } from "@/features/vault/useVault";
import type { View } from "@/lib/types";

export type Deletion = {
  kind: Page | "groups";
  id: string;
  name: string;
  ids?: string[];
};

const commands = {
  hosts: "delete_host",
  identities: "delete_identity",
  groups: "delete_group",
  keys: "delete_key",
} as const;

/** The delete confirmation for hosts, folders, identities and keys. */
export function useDeletion(
  { update, run, invokeScoped, setError }: VaultApi,
  group: string,
  clearGroup: () => void,
) {
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const askDelete = (next: Deletion) => {
    setDeletion(next);
    setError("");
  };
  const closeDeletion = () => {
    setDeletion(null);
    setError("");
  };
  const confirmDeletion = () =>
    void run(async () => {
      if (!deletion) return;
      for (const id of deletion.ids ?? [deletion.id]) {
        update(await invokeScoped<View>(commands[deletion.kind], { id }));
      }
      if (deletion.kind === "groups" && deletion.id === group) clearGroup();
      setDeletion(null);
    });
  return { deletion, askDelete, closeDeletion, confirmDeletion };
}
