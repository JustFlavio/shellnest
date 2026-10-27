// Split layout: leaf {id} | split {dir: "row"|"col", ratio, a, b}. "row" puts a left of b.
export type LayoutNode =
  | { id: string }
  | { dir: "row" | "col"; ratio: number; a: LayoutNode; b: LayoutNode };
export type Edge = "left" | "right" | "top" | "bottom";
export type Box = { x: number; y: number; w: number; h: number };
export type Divider = {
  path: string;
  dir: "row" | "col";
  box: Box;
  at: number;
};
type SavedLeaf = { hostId: string } | { local: true };
export type SavedNode =
  SavedLeaf | { dir: "row" | "col"; ratio: number; a: SavedNode; b: SavedNode };

export function reorderTabs<T extends { id: string }>(
  tabs: T[],
  movingId: string,
  targetId: string,
): T[] {
  const from = tabs.findIndex((tab) => tab.id === movingId),
    to = tabs.findIndex((tab) => tab.id === targetId);
  if (from < 0 || to < 0 || from === to) return tabs;
  const next = [...tabs];
  const [tab] = next.splice(from, 1);
  next.splice(to, 0, tab);
  return next;
}
export function terminalInputChunks(text: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 8192, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
export function syncUrlForVault(raw: string, vaultId: string): string {
  if (vaultId === "personal") return raw;
  const url = new URL(raw);
  let path = url.pathname.replace(/\/+$/, "");
  if (!path.includes("/vaults/")) {
    if (path.endsWith("/vault")) path = path.slice(0, -6);
    url.pathname = `${path}/vaults/${vaultId}`;
  }
  return url.toString().replace(/\/$/, "");
}
export function leafIds(node: LayoutNode): string[] {
  return "id" in node ? [node.id] : [...leafIds(node.a), ...leafIds(node.b)];
}
// Put `node` (a leaf or a whole subtree) beside leaf `targetId`, on the given edge of it.
export function insertLeaf(
  layout: LayoutNode,
  targetId: string,
  node: LayoutNode,
  edge: Edge,
): LayoutNode {
  const dir =
      edge === "left" || edge === "right" ? ("row" as const) : ("col" as const),
    first = edge === "left" || edge === "top";
  const walk = (n: LayoutNode): LayoutNode =>
    "id" in n
      ? n.id === targetId
        ? { dir, ratio: 0.5, a: first ? node : n, b: first ? n : node }
        : n
      : { ...n, a: walk(n.a), b: walk(n.b) };
  return walk(layout);
}
// Drop zone under the cursor: the nearest edge, anywhere but the small middle square
// (within 40% of the edge counts, so there is no need to reach the border).
export function dropEdge(
  x: number,
  y: number,
  w: number,
  h: number,
): Edge | null {
  const dist = { left: x / w, right: 1 - x / w, top: y / h, bottom: 1 - y / h };
  const edge = (Object.keys(dist) as Edge[]).reduce(
    (m, k) => (dist[k] < dist[m] ? k : m),
    "left",
  );
  return dist[edge] < 0.4 ? edge : null;
}
export function replaceLeaf(
  node: LayoutNode,
  oldId: string,
  newId: string,
): LayoutNode {
  return "id" in node
    ? node.id === oldId
      ? { id: newId }
      : node
    : {
        ...node,
        a: replaceLeaf(node.a, oldId, newId),
        b: replaceLeaf(node.b, oldId, newId),
      };
}
// Saved templates reference hosts instead of sessions. `describe(sessionId)` returns a leaf
// ({hostId} | {local: true}) or null for sessions that cannot be saved; those leaves are dropped.
export function toTemplate(
  node: LayoutNode,
  describe: (id: string) => SavedLeaf | null,
): SavedNode | null {
  if ("id" in node) return describe(node.id);
  const a = toTemplate(node.a, describe),
    b = toTemplate(node.b, describe);
  return a && b ? { dir: node.dir, ratio: node.ratio, a, b } : (a ?? b);
}
// Inverse: a session layout with fresh ids, plus the saved leaf behind each id (in layout order).
export function fromTemplate(
  node: SavedNode,
  newId: () => string,
): { layout: LayoutNode; leaves: { id: string; spec: SavedLeaf }[] } {
  if (!("dir" in node)) {
    const id = newId();
    return { layout: { id }, leaves: [{ id, spec: node }] };
  }
  const a = fromTemplate(node.a, newId),
    b = fromTemplate(node.b, newId);
  return {
    layout: { dir: node.dir, ratio: node.ratio, a: a.layout, b: b.layout },
    leaves: [...a.leaves, ...b.leaves],
  };
}
// Saved-layout leaves that fail `keep` are dropped; a split left with one child collapses into it.
export function pruneTemplate(
  node: SavedNode,
  keep: (leaf: SavedLeaf) => boolean,
): SavedNode | null {
  if (!("dir" in node)) return keep(node) ? node : null;
  const a = pruneTemplate(node.a, keep),
    b = pruneTemplate(node.b, keep);
  return a && b ? { ...node, a, b } : (a ?? b);
}
// Rows of a near-square grid, equal shares: 2 and 3 -> side by side, 4 -> 2x2, 5 -> 3 over 2.
export function gridLayout<T extends SavedNode>(leaves: T[]): SavedNode {
  const chain = (nodes: SavedNode[], dir: "row" | "col"): SavedNode =>
    nodes.length === 1
      ? nodes[0]
      : {
          dir,
          ratio: 1 / nodes.length,
          a: nodes[0],
          b: chain(nodes.slice(1), dir),
        };
  const rows = Math.floor(Math.sqrt(leaves.length)),
    cols = Math.ceil(leaves.length / rows),
    lines: SavedNode[] = [];
  for (let i = 0; i < leaves.length; i += cols)
    lines.push(chain(leaves.slice(i, i + cols), "row"));
  return chain(lines, "col");
}
// Open tabs as saved layouts (one item per tab bar entry); quick connections are skipped.
export function snapshotSession(
  tabs: {
    id: string;
    parent?: string;
    name?: string;
    layout?: LayoutNode;
    kind: string;
    host?: { id: string };
  }[],
  activeId: string,
): { items: { name?: string; layout: SavedNode }[]; active: number } {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const describe = (id: string): SavedLeaf | null => {
    const t = byId.get(id);
    return t?.kind === "ssh"
      ? { hostId: t.host!.id } // an ssh tab always has its host
      : t?.kind === "local"
        ? { local: true }
        : null;
  };
  const items: { name?: string; layout: SavedNode }[] = [];
  let active = 0;
  for (const t of tabs) {
    if (t.parent) continue;
    const layout = t.layout ? toTemplate(t.layout, describe) : describe(t.id);
    if (!layout) continue;
    if (t.id === activeId) active = items.length;
    items.push({ name: t.name, layout });
  }
  return { items, active };
}
// Returns the tree without the leaf, or null when it was the only one.
export function removeLeaf(node: LayoutNode, id: string): LayoutNode | null {
  if ("id" in node) return node.id === id ? null : node;
  const a = removeLeaf(node.a, id),
    b = removeLeaf(node.b, id);
  return !a ? b : !b ? a : { ...node, a, b };
}
// Pane rects and divider handles as fractions of the workspace; path locates a split.
export function layoutRects(
  node: LayoutNode,
  box: Box = { x: 0, y: 0, w: 1, h: 1 },
  path = "",
): { panes: Record<string, Box>; dividers: Divider[] } {
  if ("id" in node) return { panes: { [node.id]: box }, dividers: [] };
  const row = node.dir === "row",
    size = (row ? box.w : box.h) * node.ratio,
    first = row ? { ...box, w: size } : { ...box, h: size },
    second = row
      ? { ...box, x: box.x + size, w: box.w - size }
      : { ...box, y: box.y + size, h: box.h - size },
    a = layoutRects(node.a, first, path + "a"),
    b = layoutRects(node.b, second, path + "b");
  return {
    panes: { ...a.panes, ...b.panes },
    dividers: [
      { path, dir: node.dir, box, at: row ? second.x : second.y },
      ...a.dividers,
      ...b.dividers,
    ],
  };
}
export function setRatio(
  node: LayoutNode,
  path: string,
  ratio: number,
): LayoutNode {
  if ("id" in node) return node;
  const r = Math.min(0.9, Math.max(0.1, ratio));
  if (!path) return { ...node, ratio: r };
  const key = path[0] as "a" | "b"; // layoutRects builds paths from a and b only
  return { ...node, [key]: setRatio(node[key], path.slice(1), ratio) };
}
