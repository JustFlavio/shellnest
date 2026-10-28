import assert from "node:assert/strict";
import test from "node:test";
import { MAX_WORKSPACE_HOSTS } from "./launcher-results.ts";
import type { LauncherResult } from "./launcher-results.ts";
import {
  clickRow,
  collapsed,
  isSelected,
  markedHostIds,
  pickedHosts,
} from "./launcher-selection.ts";
import { i18n } from "../../i18n/i18n.ts";

// These assertions read the Italian copy.
await i18n.changeLanguage("it");

const hostRow = (id: string): LauncherResult =>
  ({
    key: `host-${id}`,
    group: "hosts",
    kind: "host",
    title: id,
    path: "",
    host: { id },
  }) as LauncherResult;
const other = (kind: "tab" | "local"): LauncherResult => ({
  key: kind,
  group: kind === "tab" ? "tabs" : "quick",
  kind,
  title: kind,
  path: "",
});
// 0 tab, 1..4 hosts a-d, 5 local
const rows = [
  other("tab"),
  ...["a", "b", "c", "d"].map(hostRow),
  other("local"),
];

test("a plain click selects one row and drops the marks", () => {
  const marked = {
    cursor: 2,
    anchor: 1,
    marks: ["host-a", "host-b"],
    chosen: true,
  };
  assert.deepEqual(clickRow(marked, rows, 4, "single"), collapsed(4, true));
});

test("Cmd+click starts from the cursor host and toggles rows", () => {
  const one = clickRow(collapsed(1), rows, 3, "toggle");
  assert.deepEqual(one, {
    cursor: 3,
    anchor: 3,
    marks: ["host-a", "host-c"],
    chosen: true,
  });
  const off = clickRow(one, rows, 1, "toggle");
  assert.deepEqual(off, {
    cursor: 3,
    anchor: 3,
    marks: ["host-c"],
    chosen: true,
  });
  const last = clickRow(off, rows, 3, "toggle");
  assert.deepEqual(last, collapsed(3, true));
});

test("toggling off the cursor row moves the cursor to a marked row", () => {
  const sel = {
    cursor: 3,
    anchor: 3,
    marks: ["host-a", "host-c"],
    chosen: true,
  };
  assert.equal(clickRow(sel, rows, 3, "toggle").cursor, 1);
});

test("a cursor on a tab does not join the marks", () => {
  const sel = clickRow(collapsed(0), rows, 2, "toggle");
  assert.deepEqual(sel.marks, ["host-b"]);
});

test("only host rows join a multi-selection", () => {
  assert.deepEqual(
    clickRow(collapsed(1), rows, 5, "toggle"),
    collapsed(5, true),
  );
  assert.deepEqual(
    clickRow(collapsed(1), rows, 0, "range"),
    collapsed(0, true),
  );
});

test("Shift+click marks the hosts between the anchor and the row", () => {
  const down = clickRow(collapsed(0), rows, 3, "range");
  assert.deepEqual(down.marks, ["host-a", "host-b", "host-c"]);
  assert.equal(down.cursor, 3);
  const up = clickRow(collapsed(4), rows, 2, "range");
  assert.deepEqual(up.marks, ["host-d", "host-c", "host-b"]);
  assert.equal(up.anchor, 4);
  const again = clickRow(down, rows, 4, "range");
  assert.deepEqual(again.marks, ["host-a", "host-b", "host-c", "host-d"]);
});

test("selections stop at the workspace limit", () => {
  const many = Array.from({ length: MAX_WORKSPACE_HOSTS + 3 }, (_, i) =>
    hostRow(`h${i}`),
  );
  const range = clickRow(collapsed(0), many, many.length - 1, "range");
  assert.equal(range.marks.length, MAX_WORKSPACE_HOSTS);
  assert.equal(range.cursor, MAX_WORKSPACE_HOSTS - 1);
  assert.equal(clickRow(range, many, many.length - 1, "toggle"), range);
});

test("the marked rows, or the cursor row, show as selected", () => {
  const sel = {
    cursor: 2,
    anchor: 1,
    marks: ["host-a", "host-b"],
    chosen: true,
  };
  assert.deepEqual(
    rows.map((_, i) => isSelected(sel, rows, i)),
    [false, true, true, false, false, false],
  );
  assert.equal(isSelected(collapsed(4, true), rows, 4), true);
  assert.equal(isSelected(collapsed(4, true), rows, 3), false);
});

test("the row highlighted on its own is not selected until chosen", () => {
  assert.equal(isSelected(collapsed(1), rows, 1), false);
  assert.deepEqual(pickedHosts(collapsed(1), rows), []);
  assert.deepEqual(
    pickedHosts(collapsed(2, true), rows).map((h) => h.id),
    ["b"],
  );
  assert.deepEqual(pickedHosts(collapsed(0, true), rows), []);
});

test("marked hosts come in the order they are listed", () => {
  assert.deepEqual(markedHostIds(rows, ["host-c", "host-a", "local"]), [
    "a",
    "c",
  ]);
});
