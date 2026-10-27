import { useEffect, useRef, useState } from "react";
import { subtreeIds } from "./groups.mjs";
import type { View } from "@/lib/types";

export type Page = "hosts" | "identities" | "keys";

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
    [layout, setLayout] = useState<"list" | "cards">("cards");
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const search = useRef<HTMLInputElement>(null);
  const clearSelection = () => {
    setSelected(new Set());
    setSelectedFolders(new Set());
  };
  useEffect(() => {
    clearSelection();
  }, [group, query, page, view.vaultId]);
  useEffect(() => {
    const ids = new Set(view.hosts.map((h) => h.id));
    setSelected((old) =>
      [...old].every((id) => ids.has(id))
        ? old
        : new Set([...old].filter((id) => ids.has(id))),
    );
  }, [view.hosts]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`shellnest.layout.${view.vaultId}`);
      setLayout(saved === "list" ? "list" : "cards");
    } catch {
      setLayout("cards");
    }
  }, [view.vaultId]);
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
