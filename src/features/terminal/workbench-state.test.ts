import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reorderTabs,
  leafIds,
  insertLeaf,
  dropEdge,
  replaceLeaf,
  toTemplate,
  fromTemplate,
  pruneTemplate,
  gridLayout,
  snapshotSession,
  removeLeaf,
  layoutRects,
  setRatio,
  terminalInputChunks,
  syncUrlForVault,
} from "./workbench-state.ts";
import type { LayoutNode, SavedNode } from "./workbench-state.ts";

// Narrows a node the test knows is a split.
function split<N extends LayoutNode | SavedNode>(
  node: N,
): Extract<N, { dir: unknown }> {
  assert.ok("dir" in node);
  return node as Extract<N, { dir: unknown }>;
}
test("reordering preserves tab identity, input and unknown drags", () => {
  const tabs = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const moved = reorderTabs(tabs, "a", "c");
  assert.deepEqual(
    moved.map((t) => t.id),
    ["b", "c", "a"],
  );
  assert.equal(moved[2], tabs[0]);
  assert.equal(tabs[0].id, "a");
  assert.deepEqual(
    reorderTabs(tabs, "c", "a").map((t) => t.id),
    ["c", "a", "b"],
  );
  assert.equal(reorderTabs(tabs, "unknown", "a"), tabs);
  assert.equal(reorderTabs(tabs, "a", "a"), tabs);
});
test("terminal paste chunks preserve Unicode and fit backend limit", () => {
  const input = "a".repeat(8191) + "😀" + "b".repeat(80000);
  const chunks = terminalInputChunks(input);
  assert.equal(chunks.join(""), input);
  assert.ok(
    chunks.every(
      (c) => Buffer.byteLength(c) < 65536 && !/[\ud800-\udbff]$/.test(c),
    ),
  );
  assert.deepEqual(terminalInputChunks(""), []);
});
test("sync endpoints isolate newly created vaults and preserve explicit remote id", () => {
  assert.equal(
    syncUrlForVault("https://sync.example.com", "personal"),
    "https://sync.example.com",
  );
  assert.equal(
    syncUrlForVault("https://sync.example.com", "work"),
    "https://sync.example.com/vaults/work",
  );
  assert.equal(
    syncUrlForVault("https://sync.example.com/vault", "work"),
    "https://sync.example.com/vaults/work",
  );
  assert.equal(
    syncUrlForVault("https://sync.example.com/vaults/other", "work"),
    "https://sync.example.com/vaults/other",
  );
});
test("split layout: split, rects, resize and remove", () => {
  let l = insertLeaf({ id: "a" }, "a", { id: "b" }, "right");
  l = insertLeaf(l, "b", { id: "c" }, "bottom");
  assert.deepEqual(leafIds(l), ["a", "b", "c"]);
  const { panes, dividers } = layoutRects(l);
  assert.deepEqual(panes.a, { x: 0, y: 0, w: 0.5, h: 1 });
  assert.deepEqual(panes.c, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  assert.deepEqual(
    dividers.map((d) => d.path),
    ["", "b"],
  );
  const root = split(l);
  assert.equal(split(setRatio(l, "", 0.99)).ratio, 0.9);
  assert.equal(split(split(setRatio(l, "b", 0.25)).b).ratio, 0.25);
  assert.deepEqual(removeLeaf(l, "a"), root.b);
  assert.deepEqual(removeLeaf(l, "c"), { ...root, b: { id: "b" } });
  assert.equal(removeLeaf({ id: "a" }, "a"), null);
});
test("dropping on an edge nests a subtree on that side; the middle is no drop", () => {
  const sub: LayoutNode = {
    dir: "col",
    ratio: 0.5,
    a: { id: "x" },
    b: { id: "y" },
  };
  const l = insertLeaf({ id: "a" }, "a", sub, "left");
  assert.deepEqual(leafIds(l), ["x", "y", "a"]);
  assert.equal(split(l).dir, "row");
  assert.deepEqual(leafIds(insertLeaf(l, "a", { id: "z" }, "top")), [
    "x",
    "y",
    "z",
    "a",
  ]);
  assert.equal(dropEdge(5, 50, 100, 100), "left");
  assert.equal(dropEdge(50, 95, 100, 100), "bottom");
  assert.equal(dropEdge(50, 50, 100, 100), null);
  // A generous zone: well short of the border still picks the nearest edge.
  assert.equal(dropEdge(35, 50, 100, 100), "left");
  assert.equal(dropEdge(50, 62, 100, 100), "bottom");
  assert.equal(dropEdge(45, 55, 100, 100), null);
});
test("replacing a leaf keeps the layout shape", () => {
  const l = insertLeaf({ id: "a" }, "a", { id: "b" }, "right");
  assert.deepEqual(
    replaceLeaf(l, "b", "c"),
    insertLeaf({ id: "a" }, "a", { id: "c" }, "right"),
  );
});
test("templates save hosts, drop unsavable sessions and restore with fresh ids", () => {
  let l = insertLeaf({ id: "a" }, "a", { id: "b" }, "right");
  l = insertLeaf(l, "b", { id: "q" }, "bottom");
  const saved = toTemplate(l, (id) =>
    id === "a" ? { hostId: "h1" } : id === "b" ? { local: true } : null,
  );
  assert.deepEqual(saved, {
    dir: "row",
    ratio: 0.5,
    a: { hostId: "h1" },
    b: { local: true },
  });
  assert.equal(
    toTemplate({ id: "q" }, () => null),
    null,
  );
  let n = 0;
  const { layout, leaves } = fromTemplate(saved, () => `s${++n}`);
  assert.deepEqual(leafIds(layout), ["s1", "s2"]);
  assert.deepEqual(leaves, [
    { id: "s1", spec: { hostId: "h1" } },
    { id: "s2", spec: { local: true } },
  ]);
});
test("grid layouts are near-square and stay within the saved ratio range", () => {
  const leaves = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ hostId: `h${i}` }));
  const ids = (n: number) => {
    const out: string[] = [];
    const walk = (x: SavedNode): void => {
      if ("dir" in x) {
        walk(x.a);
        walk(x.b);
      } else if ("hostId" in x) out.push(x.hostId);
    };
    walk(gridLayout(leaves(n)));
    return out;
  };
  assert.deepEqual(gridLayout(leaves(1)), { hostId: "h0" });
  assert.equal(split(gridLayout(leaves(2))).dir, "row");
  const four = split(gridLayout(leaves(4)));
  assert.equal(four.dir, "col");
  assert.equal(split(four.a).dir, "row");
  assert.deepEqual(ids(7), ["h0", "h1", "h2", "h3", "h4", "h5", "h6"]);
  const ratios = (x: SavedNode): number[] =>
    "dir" in x ? [x.ratio, ...ratios(x.a), ...ratios(x.b)] : [];
  assert.ok(
    ratios(gridLayout(leaves(16))).every((r) => r >= 0.05 && r <= 0.95),
  );
});
test("pruning a saved layout collapses splits; sessions snapshot per tab", () => {
  const l: SavedNode = {
    dir: "row",
    ratio: 0.5,
    a: { hostId: "gone" },
    b: { local: true },
  };
  assert.deepEqual(
    pruneTemplate(l, (x) => !("hostId" in x) || x.hostId !== "gone"),
    { local: true },
  );
  assert.equal(
    pruneTemplate({ hostId: "gone" }, () => false),
    null,
  );
  const tabs: Parameters<typeof snapshotSession>[0] = [
    {
      id: "a",
      kind: "ssh",
      host: { id: "h1" },
      layout: { dir: "row", ratio: 0.5, a: { id: "a" }, b: { id: "b" } },
      name: "Db",
    },
    { id: "b", kind: "local", parent: "a" },
    { id: "c", kind: "quick" },
    { id: "d", kind: "ssh", host: { id: "h2" } },
  ];
  const snap = snapshotSession(tabs, "d");
  assert.equal(snap.items.length, 2);
  assert.equal(snap.active, 1);
  assert.equal(snap.items[0].name, "Db");
  assert.deepEqual(snap.items[1].layout, { hostId: "h2" });
});
