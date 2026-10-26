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
