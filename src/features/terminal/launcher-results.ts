import type { Group, Host, Identity, Workspace } from "../../lib/types.ts";
import { groupPath } from "../hosts/groups.ts";
import type { SavedNode } from "./workbench-state.ts";

export type LauncherTab = {
  id: string;
  title: string;
  subtitle?: string;
  // the saved host this tab is a session of; absent for quick and local tabs
  hostId?: string;
  // saved hosts in the panes of this tab's split workspace
  paneHostIds?: string[];
  // when the tab was last shown; larger is newer
  lastActive: number;
};
export type RecentHost = Host & {
  lastConnectedAt?: number | null;
  os?: string | null;
};
export type LauncherResult = {
  key: string;
  kind: "workspace" | "tab" | "host";
  title: string;
  path: string;
  os?: string | null;
  workspace?: Workspace;
  tab?: LauncherTab;
  host?: RecentHost;
  // for a host: the open tab that row switches to
  openTab?: LauncherTab;
};

export const MAX_WORKSPACE_HOSTS = 16;

// Saved layouts count their leaves the same way a live layout does.
export function workspaceSize(workspace: Workspace): number {
  const count = (node: SavedNode): number =>
    "dir" in node ? count(node.a) + count(node.b) : 1;
  return count(workspace.layout);
}

// Adds or removes a host in the picked list (null: not picking), up to the workspace limit.
export function togglePicked(
  picked: string[] | null,
  id: string,
): string[] | null {
  if (!picked) return picked;
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  return picked.length < MAX_WORKSPACE_HOSTS ? [...picked, id] : picked;
}

const recentFirst = (a: RecentHost, b: RecentHost): number =>
  (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0) ||
  a.name.localeCompare(b.name);

// The open tab of a host that was used last, among the tabs showing it (panes of a split included).
const latestTab = (
  tabs: LauncherTab[],
  hostId: string,
): LauncherTab | undefined =>
  tabs
    .filter((t) => t.hostId === hostId || t.paneHostIds?.includes(hostId))
    .reduce(
      (best: LauncherTab | undefined, t) =>
        !best || t.lastActive > best.lastActive ? t : best,
      undefined,
    );

// What the launcher lists for a query: saved workspaces, then (only when searching) what is
// open, then the other saved hosts, most recently used first. A host with an open session is
// one row that switches to it; tabs that are not saved hosts keep their own row. Picking
// hosts for a new workspace shows plain host rows only.
export function launcherResults({
  query,
  vaultName,
  groups,
  hosts,
  identities,
  workspaces,
  tabs,
  selecting,
}: {
  query: string;
  vaultName: string;
  groups: Group[];
  hosts: RecentHost[];
  identities: Identity[];
  workspaces: Workspace[];
  tabs: LauncherTab[];
  selecting: boolean;
}): { text: string; hasRecent: boolean; results: LauncherResult[] } {
  const text = query.trim().toLocaleLowerCase();
  const matches = (value: string) =>
    !text || value.toLocaleLowerCase().includes(text);
  const identityById = new Map(identities.map((i) => [i.id, i]));
  const sorted = [...hosts].sort(recentFirst);
  const savedIds = new Set(hosts.map((h) => h.id));
  const searching = !!text && !selecting;
  const openTab = (host: RecentHost) =>
    searching ? latestTab(tabs, host.id) : undefined;
  const hostMatches = (host: RecentHost) =>
    matches(
      `${host.name} ${host.address} ${groupPath(groups, host.groupId)} ${identityById.get(host.effectiveIdentityId || host.identityId)?.username ?? host.username ?? ""}`,
    ) ||
    (searching &&
      tabs.some(
        (t) =>
          t.hostId === host.id && matches(`${t.title} ${t.subtitle ?? ""}`),
      ));
  const hostRow = (host: RecentHost, tab?: LauncherTab): LauncherResult => ({
    key: `host-${host.id}`,
    kind: "host",
    title: host.name,
    path: host.groupId
      ? `${vaultName} / ${groupPath(groups, host.groupId)}`
      : vaultName,
    os: host.os,
    host,
    ...(tab ? { openTab: tab } : {}),
  });
  const matching = text ? sorted.filter(hostMatches) : sorted;
  const openRows: LauncherResult[] = [];
  const restRows: LauncherResult[] = [];
  for (const host of matching) {
    const tab = openTab(host);
    (tab ? openRows : restRows).push(hostRow(host, tab));
  }
  // Newest-used first inside the open group; tab rows (not saved hosts) slot in by the same order.
  const tabRows = (searching ? tabs : [])
    .filter((t) => !(t.hostId && savedIds.has(t.hostId)))
    .filter((t) => matches(`${t.title} ${t.subtitle ?? ""}`))
    .map((tab): LauncherResult => ({
      key: `tab-${tab.id}`,
      kind: "tab",
      title: tab.title,
      path: tab.subtitle ?? "Scheda aperta",
      tab,
    }));
  // tab rows carry `tab`, open host rows carry `openTab`
  const activity = (r: LauncherResult) =>
    (r.kind === "tab" ? r.tab : r.openTab)!.lastActive;
  const open = [...openRows, ...tabRows].sort(
    (a, b) => activity(b) - activity(a),
  );
  const all: LauncherResult[] = [
    ...workspaces
      .filter((workspace) => matches(workspace.name))
      .map((workspace): LauncherResult => ({
        key: `workspace-${workspace.id}`,
        kind: "workspace",
        title: workspace.name,
        path: `${workspaceSize(workspace)} connessioni`,
        workspace,
      })),
    ...open,
    ...restRows,
  ];
  return {
    text,
    hasRecent: sorted.some((h) => (h.lastConnectedAt ?? 0) > 0),
    results: selecting ? all.filter((r) => r.kind === "host") : all,
  };
}

// What a key press does in the search box: move the selection, open it, quick-connect to the
// typed target when nothing matches, or clear the query. Cmd/Ctrl+Enter is the explicit quick
// connect: it connects when the text is a target and an identity is picked, otherwise it
// reveals the quick-connect card so the identity can be chosen. Null: leave the key alone.
export type LauncherKeyAction =
  | { type: "clear" | "activate" | "quick" }
  | { type: "select"; index: number };

export function launcherKeyAction(
  key: string,
  {
    count,
    selected,
    busy,
    canQuickConnect,
    modified = false,
  }: {
    count: number;
    selected: number;
    busy: boolean;
    // the typed text is a target the card shows for, and nothing blocks connecting
    canQuickConnect: boolean;
    // Cmd/Ctrl is held
    modified?: boolean;
  },
): LauncherKeyAction | null {
  if (key === "Escape") return { type: "clear" };
  if (key === "ArrowDown" && count)
    return { type: "select", index: (selected + 1) % count };
  if (key === "ArrowUp" && count)
    return { type: "select", index: (selected + count - 1) % count };
  if (key !== "Enter") return null;
  // Cmd/Ctrl+Enter starts the connection timeline for any text that parses as a target.
  if (modified) return canQuickConnect ? { type: "quick" } : null;
  if (count) return busy ? null : { type: "activate" };
  return canQuickConnect ? { type: "quick" } : null;
}

export function listHeading({
  picking,
  text,
  hasRecent,
}: {
  picking: boolean;
  text: string;
  hasRecent: boolean;
}): string {
  if (picking) return "Scegli gli host";
  if (text) return "Risultati";
  return hasRecent ? "Connessioni recenti" : "Host salvati";
}
