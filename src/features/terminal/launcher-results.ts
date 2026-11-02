import { t } from "../../i18n/i18n.ts";
import type { Group, Host, Identity, Workspace } from "../../lib/types.ts";
import { groupPath } from "../hosts/groups.ts";
import type { ConnectionTarget } from "./connection-target.ts";
import type { SavedNode } from "./workbench-state.ts";

export type LauncherTab = {
  id: string;
  title: string;
  subtitle?: string;
  // the saved host this tab is a session of; absent for quick and local tabs
  hostId?: string;
  // when the tab was last shown; larger is newer
  lastActive: number;
};
export type RecentHost = Host & {
  lastConnectedAt?: number | null;
  os?: string | null;
};
type LauncherGroup = "workspace" | "tabs" | "hosts" | "quick";
export type LauncherResult = {
  key: string;
  group: LauncherGroup;
  kind: "workspace" | "tab" | "host" | "target" | "local";
  title: string;
  path: string;
  os?: string | null;
  workspace?: Workspace;
  tab?: LauncherTab;
  host?: RecentHost;
  // for a typed connection target: what Enter on the row connects to
  target?: ConnectionTarget;
};

export const MAX_WORKSPACE_HOSTS = 16;

// Saved layouts count their leaves the same way a live layout does.
export function workspaceSize(workspace: Workspace): number {
  const count = (node: SavedNode): number =>
    "dir" in node ? count(node.a) + count(node.b) : 1;
  return count(workspace.layout);
}

const recentFirst = (a: RecentHost, b: RecentHost): number =>
  (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0) ||
  a.name.localeCompare(b.name);

// The port shows only when it is not the default one.
const formatTarget = ({ username, address, port }: ConnectionTarget) =>
  `${username ? `${username}@` : ""}${address.includes(":") ? `[${address}]` : address}${port === 22 ? "" : `:${port}`}`;

const hostText = (
  host: RecentHost,
  groups: Group[],
  identityById: Map<string, Identity>,
) =>
  `${host.name} ${host.address} ${groupPath(groups, host.groupId)} ${identityById.get(host.effectiveIdentityId || host.identityId)?.username ?? host.username ?? ""}`;

const hostPath = (host: RecentHost, vaultName: string, groups: Group[]) =>
  host.groupId
    ? `${vaultName} / ${groupPath(groups, host.groupId)}`
    : vaultName;

// What the page under the search box lists, in its titled groups: the saved workspaces, then
// the saved hosts, most recently used first. Typed text goes to the search menu (menuResults).
export function launcherResults({
  vaultName,
  groups,
  hosts,
  workspaces,
}: {
  vaultName: string;
  groups: Group[];
  hosts: RecentHost[];
  workspaces: Workspace[];
}): { hasRecent: boolean; results: LauncherResult[] } {
  const sorted = [...hosts].sort(recentFirst);
  return {
    hasRecent: sorted.some((h) => (h.lastConnectedAt ?? 0) > 0),
    results: [
      ...workspaces.map((workspace): LauncherResult => ({
        key: `workspace-${workspace.id}`,
        group: "workspace",
        kind: "workspace",
        title: workspace.name,
        path: t("terminal.launcherResults.connections", {
          count: workspaceSize(workspace),
        }),
        workspace,
      })),
      ...sorted.map((host): LauncherResult => ({
        key: `host-${host.id}`,
        group: "hosts",
        kind: "host",
        title: host.name,
        path: hostPath(host, vaultName, groups),
        os: host.os,
        host,
      })),
    ],
  };
}

const quickRows = (target: ConnectionTarget | null): LauncherResult[] => [
  ...(target
    ? [
        {
          key: "target",
          group: "quick",
          kind: "target",
          title: formatTarget(target),
          path: "SSH",
          target,
        } as const,
      ]
    : []),
  {
    key: "local",
    group: "quick",
    kind: "local",
    title: t("hosts.vaultToolbar.localTerminal"),
    path: t("terminal.launcherResults.thisComputer"),
  },
];

// What the search menu under the input lists: the saved hosts that match, most recently used
// first, the open tabs, newest first, then quick connect: the typed target and the local
// terminal. The jump scope leaves the hosts out.
export function menuResults({
  query,
  vaultName,
  groups,
  hosts,
  identities,
  tabs,
  target = null,
  jump = false,
}: {
  query: string;
  vaultName: string;
  groups: Group[];
  hosts: RecentHost[];
  identities: Identity[];
  tabs: LauncherTab[];
  target?: ConnectionTarget | null;
  jump?: boolean;
}): { text: string; results: LauncherResult[] } {
  const text = query.trim().toLocaleLowerCase();
  const matches = (value: string) =>
    !text || value.toLocaleLowerCase().includes(text);
  const identityById = new Map(identities.map((i) => [i.id, i]));
  const hostById = new Map(hosts.map((h) => [h.id, h]));
  const hostRows = jump
    ? []
    : [...hosts]
        .sort(recentFirst)
        .filter((host) => matches(hostText(host, groups, identityById)))
        .map((host): LauncherResult => ({
          key: `host-${host.id}`,
          group: "hosts",
          kind: "host",
          title: host.name,
          path: hostPath(host, vaultName, groups),
          os: host.os,
          host,
        }));
  const tabRows = tabs
    .filter((t) => matches(`${t.title} ${t.subtitle ?? ""}`))
    .sort((a, b) => b.lastActive - a.lastActive)
    .map((tab): LauncherResult => ({
      key: `tab-${tab.id}`,
      group: "tabs",
      kind: "tab",
      title: tab.title,
      path: tab.subtitle ?? t("terminal.launcherResults.openTab"),
      os: tab.hostId ? hostById.get(tab.hostId)?.os : undefined,
      tab,
    }));
  return { text, results: [...hostRows, ...tabRows, ...quickRows(target)] };
}

export type ResultGroup = {
  id: LauncherGroup;
  heading: string;
  items: { result: LauncherResult; index: number }[];
};

// Splits the ordered results into their titled groups; `index` is the position in the flat
// list, which the arrow keys walk across groups.
export function groupResults(
  results: LauncherResult[],
  hasRecent: boolean,
): ResultGroup[] {
  const heading = (group: LauncherGroup) =>
    group === "workspace"
      ? t("terminal.sessionTab.workspace")
      : hasRecent
        ? t("terminal.launcherResults.recentConnections")
        : t("terminal.launcherResults.savedHosts");
  const groups: ResultGroup[] = [];
  results.forEach((result, index) => {
    let group = groups.find((g) => g.id === result.group);
    if (!group) {
      group = { id: result.group, heading: heading(result.group), items: [] };
      groups.push(group);
    }
    group.items.push({ result, index });
  });
  return groups;
}

// What a key press does in the search box: move the selection, open it, quick-connect to the
// typed target when nothing matches, or clear the query. Cmd/Ctrl+Enter is the explicit quick
// connect: it connects when the text is a target and an identity is picked, otherwise it
// reveals the quick-connect card so the identity can be chosen. Null: leave the key alone.
export type LauncherKeyAction =
  { type: "clear" | "activate" | "quick" } | { type: "select"; index: number };

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

// Why the tab and host groups are empty; asked only when they are.
export function emptyMessage({
  jump,
  text,
  hasTarget,
  nothingSaved,
  invalid = false,
}: {
  jump: boolean;
  text: string;
  hasTarget: boolean;
  nothingSaved: boolean;
  // the typed text matches nothing and is not an address either
  invalid?: boolean;
}): string {
  if (invalid && !jump) return t("terminal.launcherResults.notAValidHost");
  if (jump)
    return text
      ? t("terminal.launcherResults.noTabMatchesThe")
      : t("terminal.launcherResults.noOpenTabs");
  if (!nothingSaved) return t("terminal.launcherResults.noHostOrTab");
  return text && hasTarget
    ? t("terminal.launcherResults.noHostOrTab")
    : t("terminal.connectionLauncher.noSavedHosts");
}
