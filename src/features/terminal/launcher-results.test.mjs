import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_WORKSPACE_HOSTS,
  launcherKeyAction,
  launcherResults,
  listHeading,
  togglePicked,
  workspaceSize,
} from "./launcher-results.mjs";

const host = (id, name, extra = {}) => ({
  id,
  name,
  address: `${name}.example`,
  groupId: "",
  identityId: "",
  ...extra,
});
const base = {
  query: "",
  vaultName: "Personale",
  groups: [],
  identities: [{ id: "i1", username: "deploy" }],
  workspaces: [
    {
      id: "w1",
      name: "Stack",
      layout: { dir: "row", a: { hostId: "a" }, b: { local: true } },
    },
  ],
  tabs: [
    { id: "t1", title: "web", subtitle: "root@web.example", lastActive: 1 },
  ],
  hosts: [
    host("a", "alpha"),
    host("b", "beta", { lastConnectedAt: 5 }),
    host("c", "gamma", { identityId: "i1" }),
  ],
  selecting: false,
};
const keys = (input) =>
  launcherResults({ ...base, ...input }).results.map((r) => r.key);

test("hosts come most recently used first, then by name", () => {
  assert.deepEqual(keys({}), ["workspace-w1", "host-b", "host-a", "host-c"]);
  assert.equal(launcherResults(base).hasRecent, true);
});

test("open tabs only show while searching", () => {
  assert.ok(!keys({}).includes("tab-t1"));
  assert.deepEqual(keys({ query: "web" }), ["tab-t1"]);
});

test("a search matches the identity's user name", () => {
  assert.deepEqual(keys({ query: "DEPLOY" }), ["host-c"]);
});

test("picking hosts lists hosts only", () => {
  assert.deepEqual(keys({ selecting: true }), ["host-b", "host-a", "host-c"]);
});

test("a workspace counts its connections", () => {
  assert.equal(workspaceSize(base.workspaces[0]), 2);
  assert.equal(launcherResults(base).results[0].path, "2 connessioni");
});

test("picking stops at the limit and ignores a closed picker", () => {
  assert.equal(togglePicked(null, "a"), null);
  assert.deepEqual(togglePicked(["a"], "b"), ["a", "b"]);
  assert.deepEqual(togglePicked(["a", "b"], "a"), ["b"]);
  const full = Array.from({ length: MAX_WORKSPACE_HOSTS }, (_, i) => `h${i}`);
  assert.equal(togglePicked(full, "x"), full);
});

test("arrow keys wrap around the results", () => {
  const state = { count: 3, selected: 2, busy: false, canQuickConnect: false };
  assert.deepEqual(launcherKeyAction("ArrowDown", state), {
    type: "select",
    index: 0,
  });
  assert.deepEqual(launcherKeyAction("ArrowUp", { ...state, selected: 0 }), {
    type: "select",
    index: 2,
  });
  assert.equal(launcherKeyAction("ArrowDown", { ...state, count: 0 }), null);
});

test("Enter opens the selection, or quick-connects when nothing matches", () => {
  const state = { count: 2, selected: 0, busy: false, canQuickConnect: true };
  assert.deepEqual(launcherKeyAction("Enter", state), { type: "activate" });
  assert.equal(launcherKeyAction("Enter", { ...state, busy: true }), null);
  assert.deepEqual(launcherKeyAction("Enter", { ...state, count: 0 }), {
    type: "quick",
  });
  assert.equal(
    launcherKeyAction("Enter", { ...state, count: 0, canQuickConnect: false }),
    null,
  );
  assert.deepEqual(launcherKeyAction("Escape", state), { type: "clear" });
  assert.equal(launcherKeyAction("a", state), null);
});

test("the list heading follows picking, searching and history", () => {
  const state = { picking: false, text: "", hasRecent: true };
  assert.equal(listHeading(state), "Connessioni recenti");
  assert.equal(listHeading({ ...state, hasRecent: false }), "Host salvati");
  assert.equal(listHeading({ ...state, text: "a" }), "Risultati");
  assert.equal(
    listHeading({ ...state, picking: true, text: "a" }),
    "Scegli gli host",
  );
});

const session = (id, hostId, lastActive, extra = {}) => ({
  id,
  title: hostId,
  subtitle: `root@${hostId}.example`,
  hostId,
  lastActive,
  ...extra,
});

test("a host with open sessions is one row that switches to the latest", () => {
  const input = {
    query: "alpha",
    tabs: [session("t1", "a", 3), session("t2", "a", 7), session("t3", "a", 5)],
  };
  const { results } = launcherResults({ ...base, ...input });
  assert.deepEqual(
    results.map((r) => r.key),
    ["host-a"],
  );
  assert.equal(results[0].openTab.id, "t2");
});

test("the row also matches on the tab and carries panes of a split", () => {
  const split = {
    id: "t9",
    title: "Workspace",
    lastActive: 4,
    paneHostIds: ["c"],
  };
  const r = launcherResults({ ...base, query: "gamma", tabs: [split] }).results;
  assert.deepEqual(
    r.map((x) => x.key),
    ["host-c"],
  );
  assert.equal(r[0].openTab.id, "t9");
  assert.deepEqual(keys({ query: "workspace", tabs: [split] }), ["tab-t9"]);
});

test("open hosts and tabs come first, newest first, then the other hosts", () => {
  const tabs = [
    session("t1", "a", 2),
    { id: "t2", title: "quick", subtitle: "root@x.example", lastActive: 9 },
    session("t3", "b", 5),
  ];
  assert.deepEqual(keys({ query: "e", tabs, workspaces: [] }), [
    "tab-t2",
    "host-b",
    "host-a",
    "host-c",
  ]);
});

test("a tab of a deleted host keeps its own row", () => {
  assert.deepEqual(
    keys({ query: "ghost", tabs: [session("t1", "ghost", 1)] }),
    ["tab-t1"],
  );
});

test("without a search nothing is marked open, and picking lists plain hosts", () => {
  const tabs = [session("t1", "a", 1)];
  assert.equal(
    launcherResults({ ...base, tabs }).results[1].openTab,
    undefined,
  );
  assert.equal(
    launcherResults({ ...base, tabs, query: "alpha", selecting: true })
      .results[0].openTab,
    undefined,
  );
});

test("Cmd/Ctrl+Enter connects to a ready target and otherwise reveals the card", () => {
  const state = {
    count: 3,
    selected: 0,
    busy: false,
    canQuickConnect: true,
    modified: true,
    hasText: true,
    ready: true,
  };
  assert.deepEqual(launcherKeyAction("Enter", state), { type: "quick" });
  assert.deepEqual(launcherKeyAction("Enter", { ...state, ready: false }), {
    type: "reveal",
  });
  assert.deepEqual(
    launcherKeyAction("Enter", { ...state, canQuickConnect: false }),
    { type: "reveal" },
  );
  assert.equal(launcherKeyAction("Enter", { ...state, hasText: false }), null);
  assert.equal(launcherKeyAction("Enter", { ...state, busy: true }), null);
});
