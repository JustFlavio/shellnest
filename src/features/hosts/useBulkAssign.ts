import { useState } from "react";
import type { VaultApi } from "@/features/vault/useVault";
import type { View } from "@/lib/types";

/** Assigning one identity to many selected hosts. */
export function useBulkAssign(
  { update, run, invokeScoped, setError }: VaultApi,
  selected: Set<string>,
  setSelected: (ids: Set<string>) => void,
  clearSelection: () => void,
) {
  const [bulkIdentity, setBulkIdentity] = useState(""),
    [bulkOpen, setBulkOpen] = useState(false);
  const openBulkAssign = (hostIds: Set<string>, identityId = "") => {
    setSelected(hostIds);
    setBulkIdentity(identityId);
    setBulkOpen(true);
    setError("");
  };
  const closeBulkAssign = () => {
    setBulkOpen(false);
    setError("");
  };
  const assignIdentity = () =>
    void run(async () => {
      update(
        await invokeScoped<View>("assign_identity", {
          ids: [...selected],
          identityId: bulkIdentity,
        }),
      );
      setBulkOpen(false);
      clearSelection();
    });
  return {
    bulkIdentity,
    setBulkIdentity,
    bulkOpen,
    setBulkOpen,
    openBulkAssign,
    closeBulkAssign,
    assignIdentity,
  };
}
