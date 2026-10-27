import { useState } from "react";
import type { VaultApi } from "@/features/vault/useVault";
import type { Host, View, Workspace, WorkspaceDraft } from "@/lib/types";
import { localTab, sshTab } from "./tab-factory";
import {
  appendWorkspaces,
  planWorkspaces,
  workspaceTemplate,
} from "./tabs-state.ts";
import type { Trust, WorkspaceSave } from "./tabs-types";
import { hostIdentity } from "@/features/hosts/host-draft";
import { gridLayout } from "./workbench-state.ts";
import type { SavedNode } from "./workbench-state.ts";
import type { useLastSession } from "./useLastSession";
import type { TabList } from "./useTabList";

/** Saved workspaces and the last session: opening them, saving the current layout, deleting. */
export function useWorkspaces(
  { view, run, update, invokeScoped, setNotice }: VaultApi,
  list: TabList,
  setTrust: (trust: Trust) => void,
  lastSession: ReturnType<typeof useLastSession>,
) {
  const { tabs, active } = list;
  const [savingWs, setSavingWs] = useState<WorkspaceSave | null>(null);
  // Recreate every session of the given layouts, one tab bar entry each. Hosts not trusted yet are
  // verified first through the usual fingerprint dialog, which calls this again once approved.
  const openWorkspaces = async (
    drafts: WorkspaceDraft[],
    hosts: Host[] = view.hosts,
    activeIndex = 0,
  ) => {
    if (!drafts.length) return;
    const { built, missing, untrusted } = planWorkspaces(
      drafts,
      new Map(hosts.map((h) => [h.id, h])),
      () => crypto.randomUUID(),
    );
    if (missing) throw new Error("Un host da aprire non esiste più.");
    if (untrusted) {
      const fingerprint = await invokeScoped<string>("probe_host", {
        id: untrusted.id,
      });
      setTrust({
        host: untrusted,
        fingerprint,
        workspaces: drafts,
        activeIndex,
      });
      return;
    }
    const groups = built.map((b) => {
      const [leader, ...rest] = b.specs.map((s) =>
        s.host
          ? sshTab(
              s.host,
              hostIdentity(view.identities, s.host),
              view.vaultId,
              s.id,
            )
          : localTab(view.vaultId, s.id),
      );
      return { leader, rest, layout: b.layout, name: b.name };
    });
    list.setTabs((old) => appendWorkspaces(old, groups));
    if (active === "launcher") list.setLauncherOpen(false);
    const target = groups[Math.min(activeIndex, groups.length - 1)].leader.id;
    list.setActive(target);
    list.setFocusedPane(target);
  };
  const saveWorkspace = () =>
    void run(async () => {
      if (!savingWs) return;
      let layout: SavedNode | null;
      let leaderId: string | undefined;
      if (savingWs.hostIds) {
        layout = gridLayout(savingWs.hostIds.map((hostId) => ({ hostId })));
      } else {
        const leader = tabs.find((t) => t.id === savingWs.tabId);
        if (!leader?.layout) return;
        leaderId = leader.id;
        layout = workspaceTemplate(tabs, leader.layout);
        if (!layout)
          throw new Error(
            "Servono almeno due sessioni salvabili (host o terminale locale): le connessioni rapide non si salvano.",
          );
      }
      const name = savingWs.name.trim(),
        existing = view.workspaces.find((w) => w.name === name);
      update(
        await invokeScoped<View>("save_workspace", {
          workspace: { id: existing?.id ?? "", name, layout },
        }),
      );
      setSavingWs(null);
      setNotice(`Workspace “${name}” salvato.`);
      if (leaderId)
        list.setTabs((old) =>
          old.map((t) => (t.id === leaderId ? { ...t, name } : t)),
        );
      else await openWorkspaces([{ name, layout }]);
    });
  const openWorkspace = (ws: WorkspaceDraft) =>
    void run(() => openWorkspaces([ws]));
  const restoreSession = () => {
    const saved = lastSession();
    if (saved)
      void run(() => openWorkspaces(saved.items, view.hosts, saved.active));
  };
  const deleteWorkspace = (ws: Workspace) =>
    void run(async () => {
      update(await invokeScoped<View>("delete_workspace", { id: ws.id }));
    });
  return {
    savingWs,
    setSavingWs,
    openWorkspaces,
    saveWorkspace,
    openWorkspace,
    restoreSession,
    deleteWorkspace,
  };
}

export type Workspaces = ReturnType<typeof useWorkspaces>;
