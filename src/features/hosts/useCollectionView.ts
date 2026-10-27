import { useRef, useState } from "react";
import { subtreeIds } from "./groups.ts";
import type { View } from "@/lib/types";

export type Page = "hosts" | "identities" | "keys";

const savedLayout = (vaultId: string) => {
  try {
    return localStorage.getItem(`shellnest.layout.${vaultId}`) === "list"
      ? "list"
      : "cards";
  } catch {
    return "cards";
  }
};

/** Which page, folder, search and sort the vault browser shows, and which rows are selected. */
export function useCollectionView(
  view: View,
  setError: (error: string) => void,
  setActive: (id: string) => void,
) {
  const [page, setPage] = useState<Page>("hosts"),
    [group, setGroup] = useState(""),
    [query, setQuery] = useState(""),
    [usage, setUsage] = useState<{ ids: string[]; label: string } | null>(null),
    [sort, setSort] = useState<"name" | "recent">("name"),
    [layout, setLayout] = useState<"list" | "cards">(() =>
      savedLayout(view.vaultId),
    );
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const search = useRef<HTMLInputElement>(null);
  const clearSelection = () => {
    setSelected(new Set());
    setSelectedFolders(new Set());
  };
  // Selection and layout follow the view they were made in: adjust them while rendering, not in an effect after a stale frame.
  const [scope, setScope] = useState({
    group,
    query,
    page,
    vaultId: view.vaultId,
  });
  if (
    scope.group !== group ||
    scope.query !== query ||
    scope.page !== page ||
    scope.vaultId !== view.vaultId
  ) {
    setScope({ group, query, page, vaultId: view.vaultId });
    clearSelection();
  }
  const [knownHosts, setKnownHosts] = useState(view.hosts);
  if (knownHosts !== view.hosts) {
    setKnownHosts(view.hosts);
    const ids = new Set(view.hosts.map((h) => h.id));
    if (![...selected].every((id) => ids.has(id)))
      setSelected(new Set([...selected].filter((id) => ids.has(id))));
  }
  const [layoutVault, setLayoutVault] = useState(view.vaultId);
  if (layoutVault !== view.vaultId) {
    setLayoutVault(view.vaultId);
    setLayout(savedLayout(view.vaultId));
  }
  const changeLayout = (value: "cards" | "list") => {
    setLayout(value);
    try {
      localStorage.setItem(`shellnest.layout.${view.vaultId}`, value);
    } catch {
      /* Preference storage is optional. */
    }
  };
  const navigate = (next: Page) => {
    setPage(next);
    setActive("vault");
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
    setError("");
  };
  const openGroup = (id: string) => {
    setGroup(id);
    clearSelection();
  };
  const showFolder = (id: string) => {
    navigate("hosts");
    setGroup(id);
  };
  const clearFilters = () => {
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
    search.current?.focus();
  };
  const showUsage = (ids: string[], label: string) => {
    navigate("hosts");
    setUsage({ ids, label });
  };
  const groupHostCount = (id: string) => {
    const ids = new Set(subtreeIds(view.groups, id));
    return view.hosts.filter((h) => ids.has(h.groupId)).length;
  };
  // Everything tied to the vault being left.
  const reset = () => {
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
  };
  return {
    page,
    group,
    setGroup,
    query,
    setQuery,
    usage,
    clearUsage: () => setUsage(null),
    sort,
    setSort,
    layout,
    changeLayout,
    search,
    selected,
    setSelected,
    selectedFolders,
    setSelectedFolders,
    clearSelection,
    navigate,
    openGroup,
    showFolder,
    clearFilters,
    showUsage,
    groupHostCount,
    reset,
  };
}
