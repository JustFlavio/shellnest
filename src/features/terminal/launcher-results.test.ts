import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyMessage,
  groupResults,
  launcherKeyAction,
  launcherResults,
  listHeading,
  workspaceSize,
} from "./launcher-results.ts";
import type { LauncherTab, RecentHost } from "./launcher-results.ts";
import type { Identity } from "../../lib/types.ts";

type Input = Parameters<typeof launcherResults>[0];

const host = (id: string, name: string, extra: Partial<RecentHost> = {}) =>
  ({
    id,
    name,
    address: `${name}.example`,
    groupId: "",
    identityId: "",
    ...extra,
  }) as RecentHost;
const base: Input = {
  query: "",
  vaultName: "Personale",
  groups: [],
  identities: [{ id: "i1", username: "deploy" } as Identity],
  workspaces: [
    {
      id: "w1",
      name: "Stack",
      layout: {
        dir: "row",
        ratio: 0.5,
        a: { hostId: "a" },
        b: { local: true },
      },
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
};
const keys = (input: Partial<Input>) =>
  launcherResults({ ...base, ...input }).results.map((r) => r.key);

test("hosts come most recently used first, then by name", () => {
  assert.deepEqual(keys({}), [
    "workspace-w1",
    "host-b",
    "host-a",
    "host-c",
    "local",
  ]);
  assert.equal(launcherResults(base).hasRecent, true);
});

test("open tabs only show while searching", () => {
  assert.ok(!keys({}).includes("tab-t1"));
  assert.deepEqual(keys({ query: "web" }), ["tab-t1", "local"]);
});

test("a search matches the identity's user name", () => {
  assert.deepEqual(keys({ query: "DEPLOY" }), ["host-c", "local"]);
});

test("a workspace counts its connections", () => {
  assert.equal(workspaceSize(base.workspaces[0]), 2);
  assert.equal(launcherResults(base).results[0].path, "2 connessioni");
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

test("the list heading follows searching and history", () => {
  const state = { text: "", hasRecent: true };
  assert.equal(listHeading(state), "Connessioni recenti");
  assert.equal(listHeading({ ...state, hasRecent: false }), "Host salvati");
  assert.equal(listHeading({ ...state, text: "a" }), "Host");
});

const session = (
  id: string,
  hostId: string,
  lastActive: number,
  extra: Partial<LauncherTab> = {},
): LauncherTab => ({
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
    ["host-a", "local"],
  );
  assert.equal(results[0].openTab?.id, "t2");
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
    ["host-c", "local"],
  );
  assert.equal(r[0].openTab?.id, "t9");
  assert.deepEqual(keys({ query: "workspace", tabs: [split] }), [
    "tab-t9",
    "local",
  ]);
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
    "local",
  ]);
});

test("a tab of a deleted host keeps its own row", () => {
  assert.deepEqual(
    keys({ query: "ghost", tabs: [session("t1", "ghost", 1)] }),
    ["tab-t1", "local"],
  );
});

test("without a search nothing is marked open", () => {
  const tabs = [session("t1", "a", 1)];
  assert.equal(
    launcherResults({ ...base, tabs }).results[1].openTab,
    undefined,
  );
});

test("Cmd/Ctrl+Enter starts the timeline for a target, and does nothing otherwise", () => {
  const state = {
    count: 3,
    selected: 0,
    busy: false,
    canQuickConnect: true,
    modified: true,
  };
  assert.deepEqual(launcherKeyAction("Enter", state), { type: "quick" });
  assert.equal(
    launcherKeyAction("Enter", { ...state, canQuickConnect: false }),
    null,
  );
});

const groupsOf = (input: Partial<Input>) => {
  const { text, hasRecent, results } = launcherResults({ ...base, ...input });
  return groupResults(results, { text, hasRecent }).map((g) => [
    g.heading,
    g.items.map((i) => i.result.key),
  ]);
};

test("an open host is listed once, under Schede, not under Host", () => {
  const tabs = [session("t1", "a", 4)];
  assert.deepEqual(groupsOf({ query: "a", tabs, workspaces: [] }), [
    ["Schede", ["host-a"]],
    ["Host", ["host-b", "host-c"]],
    ["Connessione rapida", ["local"]],
  ]);
});

test("groups come in order, empty ones are left out, indexes are flat", () => {
  const tabs = [
    { id: "q", title: "quick", subtitle: "root@x.example", lastActive: 9 },
  ];
  const target = { address: "web.example", port: 22, username: "root" };
  const { results } = launcherResults({
    ...base,
    query: "e",
    tabs,
    target,
    workspaces: [],
  });
  const groups = groupResults(results, {
    text: "e",
    hasRecent: true,
  });
  assert.deepEqual(
    groups.map((g) => g.heading),
    ["Schede", "Host", "Connessione rapida"],
  );
  assert.deepEqual(
    groups.flatMap((g) => g.items.map((i) => i.index)),
    results.map((_, i) => i),
  );
  assert.deepEqual(
    groups[2].items.map((i) => i.result.key),
    ["target", "local"],
  );
  assert.equal(groups[2].items[0].result.title, "root@web.example:22");
});

test("without a search the history and the local terminal are listed", () => {
  assert.deepEqual(groupsOf({ workspaces: [] }), [
    ["Connessioni recenti", ["host-b", "host-a", "host-c"]],
    ["Connessione rapida", ["local"]],
  ]);
  assert.deepEqual(groupsOf({ workspaces: [], hosts: [] }), [
    ["Connessione rapida", ["local"]],
  ]);
});

test("the jump mode lists open tabs only, newest first", () => {
  const tabs = [
    session("t1", "a", 2),
    { id: "t2", title: "quick", subtitle: "root@x.example", lastActive: 9 },
    session("t3", "b", 5),
  ];
  const target = { address: "a", port: 22 };
  assert.deepEqual(keys({ jump: true, tabs, target }), [
    "tab-t2",
    "tab-t3",
    "tab-t1",
  ]);
  assert.deepEqual(keys({ jump: true, tabs, query: "root@x" }), ["tab-t2"]);
  assert.deepEqual(keys({ jump: true, tabs: [] }), []);
});

test("the empty message tells why nothing is listed", () => {
  const state = {
    jump: false,
    text: "x",
    hasTarget: false,
    nothingSaved: false,
    quickKey: "⌘Invio",
  };
  assert.match(emptyMessage(state), /corrisponde/);
  assert.match(emptyMessage({ ...state, nothingSaved: true }), /⌘Invio/);
  assert.match(
    emptyMessage({ ...state, jump: true }),
    /Nessuna scheda corrisponde/,
  );
  assert.equal(
    emptyMessage({ ...state, jump: true, text: "" }),
    "Nessuna scheda aperta.",
  );
});
