import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reorderTabs,
  leafIds,
  insertLeaf,
  dropEdge,
  replaceLeaf,
  removeLeaf,
  layoutRects,
  setRatio,
  terminalInputChunks,
  syncUrlForVault,
} from "./workbench-state.mjs";
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
  const moved = setRatio(l, "", 0.99);
  assert.equal(moved.ratio, 0.9);
  assert.equal(setRatio(l, "b", 0.25).b.ratio, 0.25);
  assert.deepEqual(removeLeaf(l, "a"), l.b);
  assert.deepEqual(removeLeaf(l, "c"), { ...l, b: { id: "b" } });
  assert.equal(removeLeaf({ id: "a" }, "a"), null);
});
test("dropping on an edge nests a subtree on that side; the middle is no drop", () => {
  const sub = { dir: "col", ratio: 0.5, a: { id: "x" }, b: { id: "y" } };
  const l = insertLeaf({ id: "a" }, "a", sub, "left");
  assert.deepEqual(leafIds(l), ["x", "y", "a"]);
  assert.equal(l.dir, "row");
  assert.deepEqual(leafIds(insertLeaf(l, "a", { id: "z" }, "top")), [
    "x",
    "y",
    "z",
    "a",
  ]);
  assert.equal(dropEdge(5, 50, 100, 100), "left");
  assert.equal(dropEdge(50, 95, 100, 100), "bottom");
  assert.equal(dropEdge(50, 50, 100, 100), null);
});
test("replacing a leaf keeps the layout shape", () => {
  const l = insertLeaf({ id: "a" }, "a", { id: "b" }, "right");
  assert.deepEqual(
    replaceLeaf(l, "b", "c"),
    insertLeaf({ id: "a" }, "a", { id: "c" }, "right"),
  );
});
