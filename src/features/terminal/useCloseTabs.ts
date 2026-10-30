import { useRef, useState } from "react";
import type { TerminalTab } from "@/lib/types";
import type { useCloseGuard } from "./CloseGuard";
import {
  closedRecords,
  neighbourInBar,
  sessionIds,
  unlinkPane,
} from "./tabs-state.ts";
import type { Closed } from "./tabs-state.ts";
import type { HostConnections } from "./useHostConnections";
import type { TabList } from "./useTabList";

/** Closing tabs and panes (asking first for live sessions) and reopening the last closed one. */
export function useCloseTabs(
  list: TabList,
  { dropQueue, stopVerifying, connect, startQuick, openLocal }: HostConnections,
  closeGuard: ReturnType<typeof useCloseGuard>,
) {
  const { tabs, active } = list;
  const [pendingClose, setPendingClose] = useState<string[] | null>(null);
  const closed = useRef<Closed<TerminalTab>[]>([]);
  const rememberClosed = (ids: string[]) => {
    closed.current.push(...closedRecords(tabs, ids));
  };
  const closeTab = (id: string) => {
    if (stopVerifying(id)) dropQueue();
    const ids = new Set(sessionIds(tabs, id));
    rememberClosed([...ids]);
    list.setTabs((old) => old.filter((t) => !ids.has(t.id)));
    if (active === id) list.setActive(neighbourInBar(tabs, id) ?? "vault");
  };
  const closePane = (id: string) => {
    const moved = unlinkPane(tabs, id, false);
    if (!moved) return closeTab(id);
    list.setTabs(moved.tabs);
    rememberClosed([id]);
    stopVerifying(id);
    if (active === moved.leader.id) list.setActive(moved.next);
    list.setFocusedPane(moved.next);
  };
  const isLive = (ids: string[]) => {
    const wanted = new Set(ids);
    return tabs.some(
      (t) =>
        wanted.has(t.id) &&
        (t.status === "connected" || t.filesStatus === "connected"),
    );
  };
  const askClosePane = (id: string) =>
    closeGuard.ask(isLive([id]), () => closePane(id));
  const askCloseTab = (id: string) =>
    closeGuard.ask(isLive(sessionIds(tabs, id)), () => closeTab(id));
  const closeOthers = () => {
    const gone = new Set(pendingClose);
    list.setTabs((old) => old.filter((t) => !gone.has(t.id)));
    setPendingClose(null);
  };
  const reopenTab = () => {
    const tab = closed.current.pop();
    if (!tab) return;
    if (tab.kind === "ssh") connect(tab.host);
    else if (tab.kind === "quick")
      startQuick({ ...tab.target, username: tab.username || undefined });
    else openLocal();
  };
  return {
    pendingClose,
    setPendingClose,
    closeTab,
    closePane,
    askClosePane,
    askCloseTab,
    closeOthers,
    reopenTab,
  };
}

export type CloseTabs = ReturnType<typeof useCloseTabs>;
