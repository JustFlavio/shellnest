import {
  fromTemplate,
  insertLeaf,
  leafIds,
  pruneTemplate,
  removeLeaf,
  replaceLeaf,
  toTemplate,
} from "./workbench-state.mjs";

// Tab-list transitions behind the tab bar and split workspaces. A tab with a `layout` leads a
// workspace; its panes are tabs whose `parent` is the leader and are hidden from the bar.

// Adds `clone` beside `paneId` in the leader's layout, which is created on the first split.
export function splitPane(tabs, leaderId, paneId, clone, edge) {
  return [
    ...tabs.map((t) =>
      t.id === leaderId
        ? {
            ...t,
            layout: insertLeaf(
              t.layout ?? { id: paneId },
              paneId,
              { id: clone.id },
              edge,
            ),
          }
        : t,
    ),
    clone,
  ];
}

// Moves a pane of the leader's workspace next to `targetId`; null when it cannot move.
export function rearrangePane(tabs, leaderId, paneId, targetId, edge) {
  const leader = tabs.find((t) => t.id === leaderId);
  const rest = leader?.layout && removeLeaf(leader.layout, paneId);
  if (!rest) return null;
  const layout = insertLeaf(rest, targetId, { id: paneId }, edge);
  return tabs.map((t) => (t.id === leaderId ? { ...t, layout } : t));
}

// Joins the sessions of tab `srcId` to the leader's workspace, next to `targetId`.
export function joinWorkspace(tabs, leaderId, srcId, targetId, edge) {
  const leader = tabs.find((t) => t.id === leaderId);
  const src = tabs.find((t) => t.id === srcId);
  if (!leader || !src) return null;
  const node = src.layout ?? { id: src.id },
    ids = leafIds(node),
    layout = insertLeaf(
      leader.layout ?? { id: leader.id },
      targetId,
      node,
      edge,
    );
  return tabs.map((t) =>
    t.id === leader.id
      ? { ...t, layout }
      : t.id === src.id
        ? { ...t, layout: undefined, parent: leader.id }
        : ids.includes(t.id)
          ? { ...t, parent: leader.id }
          : t,
  );
}

// Takes a pane out of its workspace (keep: it stays as its own tab). A pane is promoted if the
// leader goes. Null when the tab is not a pane of a split workspace.
export function unlinkPane(tabs, id, keep) {
  const tab = tabs.find((t) => t.id === id);
  const leader = tab?.parent ? tabs.find((t) => t.id === tab.parent) : tab;
  const rest = leader?.layout && removeLeaf(leader.layout, id);
  if (!leader || !rest) return null;
  const ids = leafIds(rest),
    next = id === leader.id ? ids[0] : leader.id;
  return {
    leader,
    next,
    tabs: tabs.flatMap((t) =>
      t.id === id
        ? keep
          ? [{ ...t, parent: undefined, layout: undefined }]
          : []
        : t.id === next
          ? [
              {
                ...t,
                name: id === leader.id ? leader.name : t.name,
                parent: undefined,
                layout: ids.length > 1 ? rest : undefined,
              },
            ]
          : [ids.includes(t.id) ? { ...t, parent: next } : t],
    ),
  };
}

// New session `next` in the slot of `id`, in the tab bar or in a split layout.
export function replaceTab(tabs, id, next) {
  return tabs.map((t) =>
    t.id === id
      ? next
      : t.parent === id
        ? { ...t, parent: next.id }
        : t.layout && leafIds(t.layout).includes(id)
          ? { ...t, layout: replaceLeaf(t.layout, id, next.id) }
          : t,
  );
}

// Appends workspaces built from `{ leader, rest, layout, name }`; panes follow their leader.
export function appendWorkspaces(tabs, groups) {
  return [
    ...tabs,
    ...groups.flatMap((g) => [
      {
        ...g.leader,
        name: g.name,
        layout: g.rest.length ? g.layout : undefined,
      },
      ...g.rest.map((t) => ({ ...t, parent: g.leader.id })),
    ]),
  ];
}

// Ids of every session closed together with the tab.
export function sessionIds(tabs, id) {
  const layout = tabs.find((t) => t.id === id)?.layout;
  return layout ? leafIds(layout) : [id];
}

// The tab to show once `id` is gone: its right neighbour in the bar, else the left one.
export function neighbourInBar(tabs, id) {
  const bar = tabs.filter((t) => !t.parent),
    index = bar.findIndex((t) => t.id === id);
  return bar[index + 1]?.id ?? bar[index - 1]?.id;
}

const leafCount = (node) =>
  "dir" in node ? leafCount(node.a) + leafCount(node.b) : 1;

// Reads the stored session of a vault, keeping only the hosts that still exist.
export function parseSession(raw, knownHostIds) {
  try {
    const saved = raw && JSON.parse(raw);
    if (!saved || !Array.isArray(saved.items)) return null;
    const items = saved.items.flatMap((item) => {
      const layout = pruneTemplate(
        item.layout,
        (leaf) => !("hostId" in leaf) || knownHostIds.has(leaf.hostId),
      );
      return layout ? [{ name: item.name, layout }] : [];
    });
    return items.length
      ? {
          items,
          active: Number(saved.active) || 0,
          count: items.reduce((sum, i) => sum + leafCount(i.layout), 0),
        }
      : null;
  } catch {
    return null;
  }
}

// A closed session as `reopen` needs it: the tab without its place in a workspace.
export function closedRecords(tabs, ids) {
  const gone = new Set(ids);
  return tabs
    .filter((t) => gone.has(t.id))
    .map(({ parent, layout, ...t }) => t);
}

// Terminal-set title of a tab; the list is returned as is when nothing changes.
export function setTermTitle(tabs, id, termTitle) {
  return tabs.some((t) => t.id === id && t.termTitle !== termTitle)
    ? tabs.map((t) => (t.id === id ? { ...t, termTitle } : t))
    : tabs;
}

// The saved form of a split workspace; null unless two or more of its sessions can be saved
// (host or local shell: quick connections are left out).
export function workspaceTemplate(tabs, layout) {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const template = toTemplate(layout, (id) => {
    const t = byId.get(id);
    return t?.kind === "ssh"
      ? { hostId: t.host.id }
      : t?.kind === "local"
        ? { local: true }
        : null;
  });
  return template && "dir" in template ? template : null;
}

// Fresh session ids for saved workspaces. `missing`: a saved host is gone; `untrusted`: the
// first host whose key is not stored yet.
export function planWorkspaces(list, hostsById, newId) {
  const built = list.map((item) => {
    const { layout, leaves } = fromTemplate(item.layout, newId);
    const specs = leaves.map(({ id, spec }) => ({
      id,
      local: !("hostId" in spec),
      host: "hostId" in spec ? hostsById.get(spec.hostId) : undefined,
    }));
    return { name: item.name, layout, specs };
  });
  const specs = built.flatMap((b) => b.specs);
  return {
    built,
    missing: specs.some((s) => !s.local && !s.host),
    untrusted: specs.find((s) => s.host && !s.host.fingerprint)?.host,
  };
}
