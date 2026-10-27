import { useEffect, useRef, useState } from "react";
import { desktop } from "@/lib/platform";
import type { useCloseGuard } from "./CloseGuard";
import type { VaultApi } from "@/features/vault/useVault";
import type { QuickConnection } from "./ConnectionLauncher";
import { hostIdentity } from "@/features/hosts/host-draft";
import {
  appendWorkspaces,
  joinWorkspace,
  neighbourInBar,
  parseSession,
  rearrangePane,
  replaceTab,
  sessionIds,
  splitPane,
  unlinkPane,
} from "./tabs-state.mjs";
import type {
  Host,
  QuickTarget,
  TerminalTab,
  View,
  Workspace,
  WorkspaceDraft,
} from "@/lib/types";
import {
  fromTemplate,
  gridLayout,
  leafIds,
  replaceLeaf,
  reorderTabs,
  setRatio,
  snapshotSession,
  toTemplate,
} from "./workbench-state.mjs";
import type { Edge, SavedNode } from "./workbench-state.mjs";

export type Trust = {
  host?: Host;
  quick?: QuickConnection;
  workspaces?: WorkspaceDraft[];
  activeIndex?: number;
  fingerprint: string;
  tabId?: string;
};
export type WorkspaceSave = {
  tabId?: string;
  hostIds?: string[];
  name: string;
};
/** Open sessions: the tab bar, split workspaces and the connection flow (host key trust included). */
export function useTabs(
  { view, preview, run, update, invokeScoped, setError, setNotice }: VaultApi,
  closeGuard: ReturnType<typeof useCloseGuard>,
) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]),
    [active, setActive] = useState("vault"),
    [focusedPane, setFocusedPane] = useState(""),
    [launcherOpen, setLauncherOpen] = useState(false),
    [launcherKey, setLauncherKey] = useState(0),
    [savingWs, setSavingWs] = useState<WorkspaceSave | null>(null),
    [trust, setTrust] = useState<Trust | null>(null),
    [pendingClose, setPendingClose] = useState<string[] | null>(null);
  const closedTabs = useRef<TerminalTab[]>([]),
    connectionQueue = useRef<Host[]>([]),
    pendingVerification = useRef(new Set<string>());
  const bar = tabs.filter((t) => !t.parent);
  const identity = (host: Host) => hostIdentity(view.identities, host);
  useEffect(() => {
    if (!desktop || !view.unlocked || !tabs.length) return;
    try {
      const snapshot = snapshotSession(tabs, active);
      if (snapshot.items.length)
        localStorage.setItem(
          `shellnest.session.${view.vaultId}`,
          JSON.stringify(snapshot),
        );
    } catch {
      // Restoring a session is a convenience; storage may be unavailable.
    }
  }, [tabs, active, view.vaultId, view.unlocked]);
  const focusOf = (leader: TerminalTab) =>
    leader.layout && leafIds(leader.layout).includes(focusedPane)
      ? focusedPane
      : leader.id;
  const addTab = (tab: TerminalTab) => {
    if (active === "launcher") setLauncherOpen(false);
    setTabs((old) => [...old, tab]);
    setActive(tab.id);
  };
  // Shortcut: clone the focused pane's session beside it.
  const splitTab = (leaderId: string, dir: "row" | "col") => {
    const leader = tabs.find((t) => t.id === leaderId);
    if (!leader) return;
    const paneId = focusOf(leader),
      src = tabs.find((t) => t.id === paneId) ?? leader,
      host =
        src.kind === "ssh"
          ? view.hosts.find((h) => h.id === src.host.id)
          : null;
    if (src.kind === "ssh" && !host?.fingerprint) return;
    const clone: TerminalTab = {
      ...src,
      id: crypto.randomUUID(),
      error: undefined,
      status: "connecting",
      parent: leaderId,
      layout: undefined,
    };
    if (clone.kind === "ssh" && host) clone.host = host;
    const edge: Edge = dir === "row" ? "right" : "bottom";
    setTabs((old) => splitPane(old, leaderId, paneId, clone, edge));
    setFocusedPane(clone.id);
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
    setTabs(next);
    setFocusedPane(srcId);
  };
  const activateTab = (id: string) => {
    setLauncherOpen(false);
    setActive(id);
  };
  const makeTab = (host: Host, id: string = crypto.randomUUID()) => {
    const i = identity(host);
    if (!i && !(host.username && host.hasPassword))
      throw new Error(
        "Inserisci le credenziali dell’host o scegli un’identità.",
      );
    return {
      id,
      kind: "ssh" as const,
      host,
      vaultId: view.vaultId,
      title: host.name,
      status: "connecting" as const,
      username: i?.username ?? host.username!,
      identityName: i?.name ?? "Credenziali dell’host",
    };
  };
  const openTab = (host: Host) => {
    const tab = makeTab(host);
    addTab(tab);
    return tab.id;
  };
  const continueConnections = async () => {
    let pendingTab: string | undefined;
    try {
      while (connectionQueue.current.length) {
        const host = connectionQueue.current[0];
        const tabId = openTab(host);
        if (!host.fingerprint) {
          pendingTab = tabId;
          pendingVerification.current.add(tabId);
          const fingerprint = await invokeScoped<string>("probe_host", {
            id: host.id,
          });
          if (!pendingVerification.current.has(tabId)) return;
          setTrust({ host, fingerprint, tabId });
          return;
        }
        connectionQueue.current.shift();
      }
    } catch (e) {
      connectionQueue.current = [];
      if (pendingTab) {
        if (!pendingVerification.current.delete(pendingTab)) return;
        setTabs((old) =>
          old.map((tab) =>
            tab.id === pendingTab
              ? { ...tab, status: "failed", error: String(e) }
              : tab,
          ),
        );
      }
      throw e;
    }
  };
  const connectHosts = (hosts: Host[]) =>
    void run(async () => {
      if (
        hosts.some(
          (host) => !identity(host) && !(host.username && host.hasPassword),
        )
      )
        throw new Error("Completa le credenziali degli host selezionati.");
      connectionQueue.current = [...hosts];
      await continueConnections();
    });
  const connect = (host: Host) => connectHosts([host]);
  const rememberClosed = (ids: string[]) => {
    const gone = new Set(ids);
    closedTabs.current.push(
      ...tabs
        .filter((t) => gone.has(t.id))
        .map(({ parent, layout, ...t }) => t as TerminalTab),
    );
  };
  const closeTab = (id: string) => {
    if (pendingVerification.current.delete(id)) connectionQueue.current = [];
    const ids = new Set(sessionIds(tabs, id));
    rememberClosed([...ids]);
    setTabs((old) => old.filter((t) => !ids.has(t.id)));
    if (active === id) setActive(neighbourInBar(tabs, id) ?? "vault");
  };
  const closePane = (id: string) => {
    const moved = unlinkPane(tabs, id, false);
    if (!moved) return closeTab(id);
    setTabs(moved.tabs);
    rememberClosed([id]);
    pendingVerification.current.delete(id);
    if (active === moved.leader.id) setActive(moved.next);
    setFocusedPane(moved.next);
  };
  const isLive = (ids: string[]) => {
    const wanted = new Set(ids);
    return tabs.some((t) => wanted.has(t.id) && t.status === "connected");
  };
  const askClosePane = (id: string) =>
    closeGuard.ask(isLive([id]), () => closePane(id));
  const askCloseTab = (id: string) =>
    closeGuard.ask(isLive(sessionIds(tabs, id)), () => closeTab(id));
  const detachPane = (id: string) => {
    const moved = unlinkPane(tabs, id, true);
    if (!moved) return;
    setTabs(moved.tabs);
    setActive(id);
    setFocusedPane(id);
  };
  const closeLauncher = () => {
    setLauncherOpen(false);
    if (active === "launcher") setActive(bar[bar.length - 1]?.id ?? "vault");
  };
  const openLauncher = () => {
    setLauncherOpen(true);
    setActive("launcher");
    setLauncherKey((k) => k + 1);
  };
  const makeLocalTab = (id: string = crypto.randomUUID()): TerminalTab => ({
    id,
    kind: "local",
    vaultId: view.vaultId,
    title: "Terminale locale",
    username: "",
    identityName: "",
    status: "connecting",
  });
  const openLocal = () => {
    if (preview) {
      setError("Il terminale locale funziona nell’app desktop.");
      return;
    }
    addTab(makeLocalTab());
  };
  const openQuick = (target: QuickTarget) => {
    const i = view.identities.find((i) => i.id === target.identityId);
    if (!i) throw new Error("Identità non disponibile");
    addTab({
      id: crypto.randomUUID(),
      kind: "quick",
      vaultId: view.vaultId,
      title: target.address,
      username: target.username ?? i.username,
      identityName: i.name,
      target,
      status: "connecting",
    });
  };
  const reopenTab = () => {
    const tab = closedTabs.current.pop();
    if (!tab) return;
    if (tab.kind === "ssh") connect(tab.host);
    else if (tab.kind === "quick") {
      try {
        openQuick(tab.target);
      } catch (e) {
        setError(String(e));
      }
    } else openLocal();
  };
  // Recreate every session of the given layouts, one tab bar entry each. Hosts not trusted yet are
  // verified first through the usual fingerprint dialog, which calls this again once approved.
  const openWorkspaces = async (
    list: WorkspaceDraft[],
    hosts: Host[] = view.hosts,
    activeIndex = 0,
  ) => {
    if (!list.length) return;
    const hostsById = new Map(hosts.map((h) => [h.id, h]));
    const built = list.map((item) => {
      const { layout, leaves } = fromTemplate(item.layout, () =>
        crypto.randomUUID(),
      );
      const specs = leaves.map(({ id, spec }) => ({
        id,
        local: !("hostId" in spec),
        host: "hostId" in spec ? hostsById.get(spec.hostId) : undefined,
      }));
      return { name: item.name, layout, specs };
    });
    const specs = built.flatMap((b) => b.specs);
    if (specs.some((s) => !s.local && !s.host))
      throw new Error("Un host da aprire non esiste più.");
    const untrusted = specs.find((s) => s.host && !s.host.fingerprint);
    if (untrusted?.host) {
      const fingerprint = await invokeScoped<string>("probe_host", {
        id: untrusted.host.id,
      });
      setTrust({
        host: untrusted.host,
        fingerprint,
        workspaces: list,
        activeIndex,
      });
      return;
    }
    const groups = built.map((b) => {
      const [leader, ...rest] = b.specs.map((s) =>
        s.host ? makeTab(s.host, s.id) : makeLocalTab(s.id),
      );
      return { leader, rest, layout: b.layout, name: b.name };
    });
    setTabs((old) => appendWorkspaces(old, groups));
    if (active === "launcher") setLauncherOpen(false);
    const target = groups[Math.min(activeIndex, groups.length - 1)].leader.id;
    setActive(target);
    setFocusedPane(target);
  };
  // The tabs open when the app was last used on this device, minus hosts that no longer exist.
  const lastSession = () => {
    try {
      return parseSession(
        localStorage.getItem(`shellnest.session.${view.vaultId}`),
        new Set(view.hosts.map((h) => h.id)),
      );
    } catch {
      return null;
    }
  };
  const saveWorkspace = () =>
    void run(async () => {
      if (!savingWs) return;
      let layout: SavedNode | null;
      let leader: TerminalTab | undefined;
      if (savingWs.hostIds) {
        layout = gridLayout(savingWs.hostIds.map((hostId) => ({ hostId })));
      } else {
        leader = tabs.find((t) => t.id === savingWs.tabId);
        if (!leader?.layout) return;
        const byId = new Map(tabs.map((t) => [t.id, t]));
        layout = toTemplate(leader.layout, (id) => {
          const t = byId.get(id);
          return t?.kind === "ssh"
            ? { hostId: t.host.id }
            : t?.kind === "local"
              ? { local: true as const }
              : null;
        });
        if (!layout || !("dir" in layout))
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
      if (leader) {
        const id = leader.id;
        setTabs((old) => old.map((t) => (t.id === id ? { ...t, name } : t)));
      } else await openWorkspaces([{ name, layout }]);
    });
  const quickConnect = (target: QuickConnection) =>
    void run(async () => {
      if (preview)
        throw new Error("Le connessioni funzionano nell’app desktop.");
      const fingerprint = await invokeScoped<string>("probe_target", {
        address: target.address,
        port: target.port,
      });
      setTrust({ quick: target, fingerprint });
    });
  // New session in place of `id` (same slot in the tab bar or split layout).
  const reconnectPane = (id: string) => {
    const old = tabs.find((t) => t.id === id);
    if (!old) return;
    const next: TerminalTab = {
      ...old,
      id: crypto.randomUUID(),
      error: undefined,
      status: "connecting",
    };
    if (old.layout) next.layout = replaceLeaf(old.layout, id, next.id);
    if (next.kind === "ssh")
      next.host = view.hosts.find((h) => h.id === next.host.id) ?? next.host;
    setTabs((list) => replaceTab(list, id, next));
    if (active === id) setActive(next.id);
    if (focusedPane === id) setFocusedPane(next.id);
  };
  // On a split tab both actions apply to its focused pane.
  const duplicateTab = (tab: TerminalTab, reconnect = false) => {
    if (!reconnect && tab.layout) return splitTab(tab.id, "row");
    const target = tabs.find((t) => t.id === focusOf(tab)) ?? tab;
    if (target.kind === "ssh") {
      const host = view.hosts.find((h) => h.id === target.host.id);
      if (reconnect && host?.fingerprint) return reconnectPane(target.id);
      if (reconnect) closePane(target.id);
      if (host) connect(host);
      return;
    }
    if (reconnect) return reconnectPane(target.id);
    addTab({
      ...target,
      error: undefined,
      id: crypto.randomUUID(),
      status: "connecting",
    });
  };
  // The user's answer on an unknown host key: run again once it is trusted.
  const approveTrust = () =>
    void run(async () => {
      if (!trust) return;
      if (trust.quick) {
        openQuick({ ...trust.quick, expectedFingerprint: trust.fingerprint });
      } else if (trust.host) {
        await invokeScoped("trust_host", {
          id: trust.host.id,
          expected: trust.fingerprint,
          address: trust.host.address,
          port: trust.host.port,
        });
        const next = await invokeScoped<View>("status");
        update(next);
        const approved = next.hosts.find((h) => h.id === trust.host!.id);
        if (!approved?.fingerprint) throw new Error("Impronta non salvata.");
        if (trust.workspaces) {
          setTrust(null);
          await openWorkspaces(trust.workspaces, next.hosts, trust.activeIndex);
          return;
        }
        if (trust.tabId && pendingVerification.current.delete(trust.tabId)) {
          setTabs((old) =>
            old.map((tab) =>
              tab.id === trust.tabId && tab.kind === "ssh"
                ? { ...tab, host: approved }
                : tab,
            ),
          );
        }
        connectionQueue.current.shift();
      }
      setTrust(null);
      await continueConnections();
    });
  const rejectTrust = () => {
    connectionQueue.current = [];
    if (trust?.tabId) closeTab(trust.tabId);
    setTrust(null);
  };
  const closeOthers = () => {
    const gone = new Set(pendingClose);
    setTabs((old) => old.filter((t) => !gone.has(t.id)));
    setPendingClose(null);
  };
  const reorder = (movingId: string, targetId: string) =>
    setTabs((old) => reorderTabs(old, movingId, targetId));
  const renameTab = (id: string, name?: string) =>
    setTabs((old) => old.map((t) => (t.id === id ? { ...t, name } : t)));
  const resizeActive = (path: string, ratio: number) =>
    setTabs((old) =>
      old.map((t) =>
        t.id === active && t.layout
          ? { ...t, layout: setRatio(t.layout, path, ratio) }
          : t,
      ),
    );
  const tabStatus = (id: string, status: NonNullable<TerminalTab["status"]>) =>
    setTabs((old) => old.map((t) => (t.id === id ? { ...t, status } : t)));
  const tabTitle = (id: string, termTitle?: string) =>
    setTabs((old) =>
      old.some((t) => t.id === id && t.termTitle !== termTitle)
        ? old.map((t) => (t.id === id ? { ...t, termTitle } : t))
        : old,
    );
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
  const reset = () => {
    setLauncherOpen(false);
    setSavingWs(null);
    setTabs([]);
    connectionQueue.current = [];
    pendingVerification.current.clear();
    setActive("vault");
  };
  return {
    tabs,
    bar,
    active,
    setActive,
    focusedPane,
    setFocusedPane,
    focusOf,
    launcherOpen,
    launcherKey,
    savingWs,
    setSavingWs,
    trust,
    pendingClose,
    setPendingClose,
    splitTab,
    dropOnPane,
    detachPane,
    connect,
    connectHosts,
    reopenTab,
    askClosePane,
    askCloseTab,
    activateTab,
    closeLauncher,
    openLauncher,
    openLocal,
    openQuick,
    quickConnect,
    openWorkspaces,
    lastSession,
    openWorkspace,
    restoreSession,
    deleteWorkspace,
    saveWorkspace,
    duplicateTab,
    approveTrust,
    rejectTrust,
    closeOthers,
    reorder,
    renameTab,
    resizeActive,
    tabStatus,
    tabTitle,
    closePane,
    reconnectPane,
    reset,
  };
}

export type TabsApi = ReturnType<typeof useTabs>;
