import type { VaultApi } from "@/features/vault/useVault";
import type { TerminalTab } from "@/lib/types";
import { restarted } from "./tab-factory";
import {
  joinWorkspace,
  rearrangePane,
  replaceTab,
  splitPane,
  unlinkPane,
} from "./tabs-state.ts";
import { replaceLeaf, setRatio } from "./workbench-state.ts";
import type { Edge } from "./workbench-state.ts";
import type { CloseTabs } from "./useCloseTabs";
import type { HostConnections } from "./useHostConnections";
import type { TabList } from "./useTabList";

export function usePanes(
  { view }: VaultApi,
  list: TabList,
  { connect }: HostConnections,
  { closePane }: CloseTabs,
) {
  const { tabs, active, focusedPane, focusOf } = list;
  const savedHost = (id: string) => view.hosts.find((h) => h.id === id);
  // Shortcut: clone the focused pane's session beside it.
  const splitTab = (leaderId: string, dir: "row" | "col") => {
    const leader = tabs.find((t) => t.id === leaderId);
    if (!leader) return;
    const paneId = focusOf(leader),
      src = tabs.find((t) => t.id === paneId) ?? leader,
      host = src.kind === "ssh" ? savedHost(src.host.id) : null;
    if (src.kind === "ssh" && !host?.fingerprint) return;
    const clone: TerminalTab = {
      ...restarted(src, crypto.randomUUID()),
      parent: leaderId,
      layout: undefined,
    };
    if (clone.kind === "ssh" && host) clone.host = host;
    const edge: Edge = dir === "row" ? "right" : "bottom";
    list.setTabs((old) => splitPane(old, leaderId, paneId, clone, edge));
    list.setFocusedPane(clone.id);
  };
  // Drop on a pane edge of the active workspace: a tab's sessions join it, or a pane is rearranged.
  const dropOnPane = (
    srcId: string,
    isPane: boolean,
    targetId: string,
    edge: Edge,
  ) => {
    const leader = tabs.find((t) => t.id === active);
    if (!leader || srcId === targetId || (srcId === leader.id && !isPane))
      return;
    const move = isPane ? rearrangePane : joinWorkspace;
    const next = move(tabs, leader.id, srcId, targetId, edge);
    if (!next) return;
    list.setTabs(next);
    list.setFocusedPane(srcId);
  };
  const detachPane = (id: string) => {
    const moved = unlinkPane(tabs, id, true);
    if (!moved) return;
    list.setTabs(moved.tabs);
    list.setActive(id);
    list.setFocusedPane(id);
  };
  const resizeActive = (path: string, ratio: number) =>
    list.setTabs((old) =>
      old.map((t) =>
        t.id === active && t.layout
          ? { ...t, layout: setRatio(t.layout, path, ratio) }
          : t,
      ),
    );
  // New session in place of `id` (same slot in the tab bar or split layout).
  const reconnectPane = (id: string) => {
    const old = tabs.find((t) => t.id === id);
    if (!old) return;
    const next = restarted(old, crypto.randomUUID());
    if (old.layout) next.layout = replaceLeaf(old.layout, id, next.id);
    if (next.kind === "ssh") next.host = savedHost(next.host.id) ?? next.host;
    list.setTabs((all) => replaceTab(all, id, next));
    if (active === id) list.setActive(next.id);
    if (focusedPane === id) list.setFocusedPane(next.id);
  };
  // On a split tab both actions apply to its focused pane.
  const duplicateTab = (tab: TerminalTab, reconnect = false) => {
    const target = tabs.find((t) => t.id === focusOf(tab)) ?? tab;
    if (target.kind === "ssh") {
      const host = savedHost(target.host.id);
      if (reconnect && host?.fingerprint) return reconnectPane(target.id);
      if (reconnect) closePane(target.id);
      if (host) connect(host);
      return;
    }
    if (reconnect) return reconnectPane(target.id);
    list.addTab(restarted(target, crypto.randomUUID()));
  };
  return {
    splitTab,
    dropOnPane,
    detachPane,
    resizeActive,
    reconnectPane,
    duplicateTab,
  };
}
