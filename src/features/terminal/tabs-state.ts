import type { Host, TerminalTab } from "../../lib/types.ts";
import {
  fromTemplate,
  insertLeaf,
  leafIds,
  removeLeaf,
  replaceLeaf,
  toTemplate,
} from "./workbench-state.ts";
import type { Edge, LayoutNode, SavedNode } from "./workbench-state.ts";

export type TabLike = {
  id: string;
  name?: string;
  parent?: string;
  layout?: LayoutNode;
  broadcast?: boolean;
};

export function canReconnect(
  tab: Pick<TerminalTab, "status" | "hasConnected">,
) {
  return (
    !!tab.hasConnected && (tab.status === "closed" || tab.status === "failed")
  );
}

export function setTabStatus<
  T extends Pick<TerminalTab, "id" | "status" | "hasConnected">,
>(tabs: T[], id: string, status: NonNullable<TerminalTab["status"]>): T[] {
  return tabs.map((tab) =>
    tab.id === id
      ? {
          ...tab,
          status,
          hasConnected:
            tab.hasConnected ||
            tab.status === "connected" ||
            status === "connected",
        }
      : tab,
  );
}

// Tab-list transitions behind the tab bar and split workspaces. A tab with a `layout` leads a
// workspace; its panes are tabs whose `parent` is the leader and are hidden from the bar.

// Adds `clone` beside `paneId` in the leader's layout, which is created on the first split.
export function splitPane<T extends TabLike>(
  tabs: T[],
  leaderId: string,
  paneId: string,
  clone: T,
  edge: Edge,
): T[] {
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
export function rearrangePane<T extends TabLike>(
  tabs: T[],
  leaderId: string,
  paneId: string,
  targetId: string,
  edge: Edge,
): T[] | null {
  const leader = tabs.find((t) => t.id === leaderId);
  const rest = leader?.layout && removeLeaf(leader.layout, paneId);
  if (!rest) return null;
  const layout = insertLeaf(rest, targetId, { id: paneId }, edge);
  return tabs.map((t) => (t.id === leaderId ? { ...t, layout } : t));
}

// Joins the sessions of tab `srcId` to the leader's workspace, next to `targetId`.
export function joinWorkspace<T extends TabLike>(
  tabs: T[],
  leaderId: string,
  srcId: string,
  targetId: string,
  edge: Edge,
): T[] | null {
  const leader = tabs.find((t) => t.id === leaderId);
  const src = tabs.find((t) => t.id === srcId);
  if (!leader || !src) return null;
  const node = src.layout ?? { id: src.id },
    ids = new Set(leafIds(node)),
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
        ? { ...t, layout: undefined, broadcast: undefined, parent: leader.id }
        : ids.has(t.id)
          ? { ...t, parent: leader.id }
          : t,
  );
}

// Takes a pane out of its workspace (keep: it stays as its own tab). A pane is promoted if the
// leader goes. Null when the tab is not a pane of a split workspace.
export function unlinkPane<T extends TabLike>(
  tabs: T[],
  id: string,
  keep: boolean,
): { leader: T; next: string; tabs: T[] } | null {
  const tab = tabs.find((t) => t.id === id);
  const leader = tab?.parent ? tabs.find((t) => t.id === tab.parent) : tab;
  const rest = leader?.layout && removeLeaf(leader.layout, id);
  if (!leader || !rest) return null;
  const ids = leafIds(rest),
    inRest = new Set(ids),
    next = id === leader.id ? ids[0] : leader.id;
  return {
    leader,
    next,
    tabs: tabs.flatMap((t) =>
      t.id === id
        ? keep
          ? [
              {
                ...t,
                parent: undefined,
                layout: undefined,
                broadcast: undefined,
              },
            ]
          : []
        : t.id === next
          ? [
              {
                ...t,
                name: id === leader.id ? leader.name : t.name,
                parent: undefined,
                layout: ids.length > 1 ? rest : undefined,
                // the flag lives on the leader: it follows the workspace, and ends with it
                broadcast: ids.length > 1 ? leader.broadcast : undefined,
              },
            ]
          : [inRest.has(t.id) ? { ...t, parent: next } : t],
    ),
  };
}

export function replaceTab<T extends TabLike>(
  tabs: T[],
  id: string,
  next: T,
): T[] {
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
export function appendWorkspaces<T extends TabLike>(
  tabs: T[],
  groups: { leader: T; rest: T[]; layout: LayoutNode; name?: string }[],
): T[] {
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

export function sessionIds(tabs: TabLike[], id: string): string[] {
  const layout = tabs.find((t) => t.id === id)?.layout;
  return layout ? leafIds(layout) : [id];
}

// The tab to show once `id` is gone: its right neighbour in the bar, else the left one.
export function neighbourInBar(
  tabs: TabLike[],
  id: string,
): string | undefined {
  const bar = tabs.filter((t) => !t.parent),
    index = bar.findIndex((t) => t.id === id);
  return bar[index + 1]?.id ?? bar[index - 1]?.id;
}

// Distributes over a union of tab kinds so each kind keeps its own fields.
export type Closed<T> = T extends unknown
  ? Omit<T, "parent" | "layout">
  : never;

// A closed session as `reopen` needs it: the tab without its place in a workspace.
export function closedRecords<T extends TabLike>(
  tabs: T[],
  ids: string[],
): Closed<T>[] {
  const gone = new Set(ids);
  return tabs
    .filter((t) => gone.has(t.id))
    .map(({ parent, layout, ...t }) => t as Closed<T>); // Omit of a generic is not narrowed by TS
}

// Terminal-set title of a tab; the list is returned as is when nothing changes.
export function setTermTitle<T extends TabLike & { termTitle?: string }>(
  tabs: T[],
  id: string,
  termTitle?: string,
): T[] {
  return tabs.some((t) => t.id === id && t.termTitle !== termTitle)
    ? tabs.map((t) => (t.id === id ? { ...t, termTitle } : t))
    : tabs;
}

// The saved form of a split workspace; null unless two or more of its sessions can be saved
// (host or local shell: quick connections are left out).
export function workspaceTemplate(
  tabs: (TabLike & { kind: string; host?: { id: string } })[],
  layout: LayoutNode,
): SavedNode | null {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const template = toTemplate(layout, (id) => {
    const t = byId.get(id);
    return t?.kind === "ssh"
      ? { hostId: t.host!.id } // an ssh tab always has its host
      : t?.kind === "local"
        ? { local: true }
        : null;
  });
  return template && "dir" in template ? template : null;
}

// Fresh session ids for saved workspaces. `missing`: a saved host is gone; `untrusted`: the
// first host whose key is not stored yet.
export function planWorkspaces(
  list: { name?: string; layout: SavedNode }[],
  hostsById: Map<string, Host>,
  newId: () => string,
): {
  built: {
    name?: string;
    layout: LayoutNode;
    specs: { id: string; local: boolean; host?: Host }[];
  }[];
  missing: boolean;
  untrusted?: Host;
} {
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
