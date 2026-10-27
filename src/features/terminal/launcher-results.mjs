import { groupPath } from "../hosts/groups.mjs";

export const MAX_WORKSPACE_HOSTS = 16;

// Saved layouts count their leaves the same way a live layout does.
export function workspaceSize(workspace) {
  const count = (node) => ("dir" in node ? count(node.a) + count(node.b) : 1);
  return count(workspace.layout);
}

// Adds or removes a host in the picked list (null: not picking), up to the workspace limit.
export function togglePicked(picked, id) {
  if (!picked) return picked;
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  return picked.length < MAX_WORKSPACE_HOSTS ? [...picked, id] : picked;
}

const recentFirst = (a, b) =>
  (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0) ||
  a.name.localeCompare(b.name);

// What the launcher lists for a query: saved workspaces, open tabs (only when searching) and
// hosts, most recently used first. Picking hosts for a new workspace shows hosts only.
export function launcherResults({
  query,
  vaultName,
  groups,
  hosts,
  identities,
  workspaces,
  tabs,
  selecting,
}) {
  const text = query.trim().toLocaleLowerCase();
  const matches = (value) => !text || value.toLocaleLowerCase().includes(text);
  const identityById = new Map(identities.map((i) => [i.id, i]));
  const sorted = [...hosts].sort(recentFirst);
  const matchingHosts = text
    ? sorted.filter((host) =>
        matches(
          `${host.name} ${host.address} ${groupPath(groups, host.groupId)} ${identityById.get(host.effectiveIdentityId || host.identityId)?.username ?? host.username ?? ""}`,
        ),
      )
    : sorted;
  const all = [
    ...workspaces
      .filter((workspace) => matches(workspace.name))
      .map((workspace) => ({
        key: `workspace-${workspace.id}`,
        kind: "workspace",
        title: workspace.name,
        path: `${workspaceSize(workspace)} connessioni`,
        workspace,
      })),
    ...(text
      ? tabs.filter((tab) => matches(`${tab.title} ${tab.subtitle ?? ""}`))
      : []
    ).map((tab) => ({
      key: `tab-${tab.id}`,
      kind: "tab",
      title: tab.title,
      path: tab.subtitle ?? "Scheda aperta",
      tab,
    })),
    ...matchingHosts.map((host) => ({
      key: `host-${host.id}`,
      kind: "host",
      title: host.name,
      path: host.groupId
        ? `${vaultName} / ${groupPath(groups, host.groupId)}`
        : vaultName,
      os: host.os,
      host,
    })),
  ];
  return {
    text,
    hasRecent: sorted.some((h) => (h.lastConnectedAt ?? 0) > 0),
    results: selecting ? all.filter((r) => r.kind === "host") : all,
  };
}

// What a key press does in the search box: move the selection, open it, quick-connect to the
// typed address when nothing matches, or clear the query. Null: leave the key alone.
export function launcherKeyAction(
  key,
  { count, selected, busy, canQuickConnect },
) {
  if (key === "Escape") return { type: "clear" };
  if (key === "ArrowDown" && count)
    return { type: "select", index: (selected + 1) % count };
  if (key === "ArrowUp" && count)
    return { type: "select", index: (selected + count - 1) % count };
  if (key !== "Enter") return null;
  if (count) return busy ? null : { type: "activate" };
  return canQuickConnect ? { type: "quick" } : null;
}

export function listHeading({ picking, text, hasRecent }) {
  if (picking) return "Scegli gli host";
  if (text) return "Risultati";
  return hasRecent ? "Connessioni recenti" : "Host salvati";
}
