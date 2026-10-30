import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breadcrumbs,
  selectEntry,
  visibleEntries,
  transferProgress,
} from "./file-state.ts";
import type { Directory, Transfer } from "./types.ts";
const directory: Directory = {
  path: "/",
  parent: null,
  roots: ["/"],
  entries: ["z.txt", "a", ".env"].map((name, i) => ({
    name,
    path: `/${name}`,
    kind: i === 1 ? "directory" : "file",
    size: 0,
    modified: null,
    hidden: name.startsWith("."),
  })),
};
test("file lists keep directories first and honor hidden files and filtering", () => {
  assert.deepEqual(
    visibleEntries(directory, false, "").map((e) => e.name),
    ["a", "z.txt"],
  );
  assert.deepEqual(
    visibleEntries(directory, true, "ENV").map((e) => e.name),
    [".env"],
  );
});
test("range and additive selection use visible order", () => {
  const entries = visibleEntries(directory, true, "");
  assert.equal(
    selectEntry(
      entries,
      new Set(),
      entries[2].path,
      entries[0].path,
      false,
      true,
    ).size,
    3,
  );
  assert.equal(
    selectEntry(entries, new Set(["/a"]), "/a", null, true, false).size,
    0,
  );
});
test("breadcrumbs preserve Windows drive and POSIX roots", () => {
  assert.deepEqual(
    breadcrumbs("C:\\Users\\me").map((b) => b.path),
    ["C:\\", "C:\\Users", "C:\\Users\\me"],
  );
  assert.deepEqual(
    breadcrumbs("/var/log").map((b) => b.path),
    ["/", "/var", "/var/log"],
  );
});
test("late progress cannot reinsert a removed transfer", () => {
  const queue: Transfer[] = [];
  assert.deepEqual(
    transferProgress(queue, {
      id: "old",
      bytes: 3,
      current: "x",
      status: "completed",
      error: null,
    }),
    [],
  );
});
