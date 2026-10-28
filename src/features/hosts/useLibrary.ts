import { useCollectionView } from "./useCollectionView";
import type { Page } from "./useCollectionView";
import { useBulkAssign } from "./useBulkAssign";
import { useDeletion } from "./useDeletion";
import { useEditors } from "./useEditors";
import {
  filterHosts,
  filterIdentities,
  filterKeys,
} from "./collection-rows.ts";
import type { Host } from "@/lib/types";
import type { VaultApi } from "@/features/vault/useVault";

export type { Page };
export const pageLabels: Record<Page, string> = {
  hosts: "Host",
  identities: "Identità",
  keys: "Chiavi SSH",
};

export function useLibrary(
  vault: VaultApi,
  tabs: { setActive: (id: string) => void; connect: (host: Host) => void },
) {
  const { view, setError } = vault;
  const collection = useCollectionView(view, setError, tabs.setActive);
  const editors = useEditors(
    vault,
    tabs.setActive,
    tabs.connect,
    collection.page,
    collection.group,
  );
  const deletion = useDeletion(vault, collection.group, () =>
    collection.setGroup(""),
  );
  const bulk = useBulkAssign(
    vault,
    collection.selected,
    collection.setSelected,
    collection.clearSelection,
  );
  const { query, usage } = collection;
  const hostRows = filterHosts({
    hosts: view.hosts,
    groups: view.groups,
    identities: view.identities,
    group: collection.group,
    usageIds: usage && new Set(usage.ids),
    query,
    sort: collection.sort,
  });
  const identityRows = filterIdentities({
    identities: view.identities,
    keys: view.keys,
    query,
  });
  const keyRows = filterKeys({ keys: view.keys, query });
  const reset = () => {
    collection.reset();
    editors.reset();
  };
  return {
    ...collection,
    ...editors,
    ...deletion,
    ...bulk,
    hostRows,
    identityRows,
    keyRows,
    reset,
  };
}
