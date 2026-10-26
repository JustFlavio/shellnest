export function reorderTabs(tabs, movingId, targetId) {
  const from = tabs.findIndex((tab) => tab.id === movingId),
    to = tabs.findIndex((tab) => tab.id === targetId);
  if (from < 0 || to < 0 || from === to) return tabs;
  const next = [...tabs];
  const [tab] = next.splice(from, 1);
  next.splice(to, 0, tab);
  return next;
}
export function terminalInputChunks(text) {
  const chunks = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 8192, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
export function syncUrlForVault(raw, vaultId) {
  if (vaultId === "personal") return raw;
  const url = new URL(raw);
  let path = url.pathname.replace(/\/+$/, "");
  if (!path.includes("/vaults/")) {
    if (path.endsWith("/vault")) path = path.slice(0, -6);
    url.pathname = `${path}/vaults/${vaultId}`;
  }
  return url.toString().replace(/\/$/, "");
}
// Split layout: leaf {id} | split {dir: "row"|"col", ratio, a, b}. "row" puts a left of b.
export function leafIds(node) {
  return node.id !== undefined
    ? [node.id]
    : [...leafIds(node.a), ...leafIds(node.b)];
}
// Put `node` (a leaf or a whole subtree) beside leaf `targetId`, on the given edge of it.
export function insertLeaf(layout, targetId, node, edge) {
  const dir = edge === "left" || edge === "right" ? "row" : "col",
    first = edge === "left" || edge === "top";
  const walk = (n) =>
    n.id !== undefined
      ? n.id === targetId
        ? { dir, ratio: 0.5, a: first ? node : n, b: first ? n : node }
        : n
      : { ...n, a: walk(n.a), b: walk(n.b) };
  return walk(layout);
}
// Drop zone under the cursor: the nearest edge when within 25% of it, null in the middle.
export function dropEdge(x, y, w, h) {
  const dist = { left: x / w, right: 1 - x / w, top: y / h, bottom: 1 - y / h };
  const edge = Object.keys(dist).reduce(
    (m, k) => (dist[k] < dist[m] ? k : m),
    "left",
  );
  return dist[edge] < 0.25 ? edge : null;
}
export function replaceLeaf(node, oldId, newId) {
  return node.id !== undefined
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
export function toTemplate(node, describe) {
  if (node.id !== undefined) return describe(node.id);
  const a = toTemplate(node.a, describe),
    b = toTemplate(node.b, describe);
  return a && b ? { dir: node.dir, ratio: node.ratio, a, b } : (a ?? b);
}
// Inverse: a session layout with fresh ids, plus the saved leaf behind each id (in layout order).
export function fromTemplate(node, newId) {
  if (node.dir === undefined) {
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
export function pruneTemplate(node, keep) {
  if (node.dir === undefined) return keep(node) ? node : null;
  const a = pruneTemplate(node.a, keep),
    b = pruneTemplate(node.b, keep);
  return a && b ? { ...node, a, b } : (a ?? b);
}
// Rows of a near-square grid, equal shares: 2 and 3 -> side by side, 4 -> 2x2, 5 -> 3 over 2.
export function gridLayout(leaves) {
  const chain = (nodes, dir) =>
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
    lines = [];
  for (let i = 0; i < leaves.length; i += cols)
    lines.push(chain(leaves.slice(i, i + cols), "row"));
  return chain(lines, "col");
}
// Open tabs as saved layouts (one item per tab bar entry); quick connections are skipped.
export function snapshotSession(tabs, activeId) {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const describe = (id) => {
    const t = byId.get(id);
    return t?.kind === "ssh"
      ? { hostId: t.host.id }
      : t?.kind === "local"
        ? { local: true }
        : null;
  };
  const items = [];
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
export function removeLeaf(node, id) {
  if (node.id !== undefined) return node.id === id ? null : node;
  const a = removeLeaf(node.a, id),
    b = removeLeaf(node.b, id);
  return !a ? b : !b ? a : { ...node, a, b };
}
// Pane rects and divider handles as fractions of the workspace; path locates a split.
export function layoutRects(node, box = { x: 0, y: 0, w: 1, h: 1 }, path = "") {
  if (node.id !== undefined) return { panes: { [node.id]: box }, dividers: [] };
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
export function setRatio(node, path, ratio) {
  if (node.id !== undefined) return node;
  const r = Math.min(0.9, Math.max(0.1, ratio));
  if (!path) return { ...node, ratio: r };
  const key = path[0];
  return { ...node, [key]: setRatio(node[key], path.slice(1), ratio) };
}
