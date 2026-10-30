import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/i18n/i18n";
import { useLatest } from "@/lib/useLatest";
import type { TerminalTab } from "@/lib/types";
import type { VaultApi } from "@/features/vault/useVault";
import type { useCloseGuard } from "./CloseGuard";
import type { Trust } from "./tabs-types";
import { useCloseTabs } from "./useCloseTabs";
import { useHostConnections } from "./useHostConnections";
import { usePanes } from "./usePanes";
import { useTabList } from "./useTabList";
import { useTrust } from "./useTrust";
import { useWorkspaces } from "./useWorkspaces";

export function useTabs(
  vault: VaultApi,
  closeGuard: ReturnType<typeof useCloseGuard>,
) {
  const list = useTabList();
  const [trust, setTrust] = useState<Trust | null>(null);
  const connections = useHostConnections(vault, list, setTrust);
  const closing = useCloseTabs(list, connections, closeGuard);
  const panes = usePanes(vault, list, connections, closing);
  const workspaces = useWorkspaces(vault, list, setTrust);
  const trustActions = useTrust(
    vault,
    list,
    connections,
    closing,
    workspaces,
    trust,
    setTrust,
  );
  // The toast outlives this render: its buttons read the tabs as they are when clicked.
  const latest = useLatest({
    tabs: list.tabs,
    reconnect: panes.duplicateTab,
    close: closing.closePane,
  });
  const tabStatus = (
    id: string,
    status: NonNullable<TerminalTab["status"]>,
  ) => {
    list.tabStatus(id, status);
    if (status !== "closed") return;
    const name = list.tabs.find((tab) => tab.id === id)?.title ?? "";
    toast(t("terminal.sessionEndedToast", { name }), {
      id: `ended-${id}`,
      duration: 5000,
      action: {
        label: t("terminal.paneHeader.reconnect"),
        onClick: () => {
          const tab = latest.current.tabs.find((x) => x.id === id);
          if (tab) latest.current.reconnect(tab, true);
        },
      },
      cancel: {
        label: t("terminal.connectionTimeline.close"),
        onClick: () => latest.current.close(id),
      },
    });
  };
  const reset = () => {
    list.reset();
    workspaces.setSavingWs(null);
    connections.resetConnections();
  };
  return {
    tabs: list.tabs,
    bar: list.bar,
    lastActive: list.lastActive,
    active: list.active,
    setActive: list.setActive,
    focusedPane: list.focusedPane,
    setFocusedPane: list.setFocusedPane,
    focusOf: list.focusOf,
    launcherOpen: list.launcherOpen,
    launcherKey: list.launcherKey,
    launcherMode: list.launcherMode,
    activateTab: list.activateTab,
    closeLauncher: list.closeLauncher,
    openLauncher: list.openLauncher,
    openJump: list.openJump,
    reorder: list.reorder,
    renameTab: list.renameTab,
    tabStatus,
    tabTitle: list.tabTitle,
    trust,
    savingWs: workspaces.savingWs,
    setSavingWs: workspaces.setSavingWs,
    openWorkspaces: workspaces.openWorkspaces,
    openWorkspace: workspaces.openWorkspace,
    deleteWorkspace: workspaces.deleteWorkspace,
    saveWorkspace: workspaces.saveWorkspace,
    connect: connections.connect,
    connectHosts: connections.connectHosts,
    openLocal: connections.openLocal,
    startQuick: connections.startQuick,
    finishQuick: connections.finishQuick,
    pendingClose: closing.pendingClose,
    setPendingClose: closing.setPendingClose,
    closePane: closing.closePane,
    askClosePane: closing.askClosePane,
    askCloseTab: closing.askCloseTab,
    closeOthers: closing.closeOthers,
    reopenTab: closing.reopenTab,
    splitTab: panes.splitTab,
    dropOnPane: panes.dropOnPane,
    detachPane: panes.detachPane,
    resizeActive: panes.resizeActive,
    toggleBroadcast: panes.toggleBroadcast,
    reconnectPane: panes.reconnectPane,
    duplicateTab: panes.duplicateTab,
    approveTrust: trustActions.approveTrust,
    rejectTrust: trustActions.rejectTrust,
    reset,
  };
}

export type TabsApi = ReturnType<typeof useTabs>;
