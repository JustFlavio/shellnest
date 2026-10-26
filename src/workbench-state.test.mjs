import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reorderTabs,
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
