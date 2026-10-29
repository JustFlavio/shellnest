import { useEffect, useRef, useState } from "react";
import type { TerminalTab } from "@/lib/types";
import { setTabStatus, setTermTitle } from "./tabs-state.ts";
import { leafIds, reorderTabs } from "./workbench-state.ts";

export function useTabList() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]),
    [active, setActive] = useState("vault"),
    [focusedPane, setFocusedPane] = useState(""),
    [launcherOpen, setLauncherOpen] = useState(false),
    [launcherKey, setLauncherKey] = useState(0),
    [launcherMode, setLauncherMode] = useState<"search" | "jump">("search");
  const bar = tabs.filter((t) => !t.parent);
  // when each tab was last shown, so the launcher can switch to the latest session of a host
  const shown = useRef(new Map<string, number>());
  useEffect(() => {
    shown.current.set(active, performance.now());
  }, [active]);
  const lastActive = (id: string) => shown.current.get(id) ?? 0;
  const focusOf = (leader: TerminalTab) =>
    leader.layout && leafIds(leader.layout).includes(focusedPane)
      ? focusedPane
      : leader.id;
  const addTab = (tab: TerminalTab) => {
    if (active === "launcher") setLauncherOpen(false);
    setTabs((old) => [...old, tab]);
    setActive(tab.id);
  };
  const activateTab = (id: string) => {
    setLauncherOpen(false);
    setActive(id);
  };
  const closeLauncher = () => {
    setLauncherOpen(false);
    if (active === "launcher") setActive(bar[bar.length - 1]?.id ?? "vault");
  };
  const showLauncher = (mode: "search" | "jump") => {
    setLauncherMode(mode);
    setLauncherOpen(true);
    setActive("launcher");
    setLauncherKey((k) => k + 1);
  };
  const openLauncher = () => showLauncher("search");
  const openJump = () => showLauncher("jump");
  const reorder = (movingId: string, targetId: string) =>
    setTabs((old) => reorderTabs(old, movingId, targetId));
  const renameTab = (id: string, name?: string) =>
    setTabs((old) => old.map((t) => (t.id === id ? { ...t, name } : t)));
  const tabStatus = (id: string, status: NonNullable<TerminalTab["status"]>) =>
    setTabs((old) => setTabStatus(old, id, status));
  const tabTitle = (id: string, termTitle?: string) =>
    setTabs((old) => setTermTitle(old, id, termTitle));
  const reset = () => {
    setLauncherOpen(false);
    setTabs([]);
    setActive("vault");
  };
  return {
    tabs,
    setTabs,
    bar,
    lastActive,
    active,
    setActive,
    focusedPane,
    setFocusedPane,
    focusOf,
    launcherOpen,
    setLauncherOpen,
    launcherKey,
    launcherMode,
    addTab,
    activateTab,
    closeLauncher,
    openLauncher,
    openJump,
    reorder,
    renameTab,
    tabStatus,
    tabTitle,
    reset,
  };
}

export type TabList = ReturnType<typeof useTabList>;
