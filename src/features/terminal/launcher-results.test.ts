import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyMessage,
  groupResults,
  launcherKeyAction,
  launcherResults,
  menuResults,
  workspaceSize,
} from "./launcher-results.ts";
import type { LauncherTab, RecentHost } from "./launcher-results.ts";
import type { Identity } from "../../lib/types.ts";
import { i18n } from "../../i18n/i18n.ts";

// These assertions read the Italian copy.
await i18n.changeLanguage("it");

type Input = Parameters<typeof menuResults>[0] &
  Parameters<typeof launcherResults>[0];

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
const menuKeys = (input: Partial<Input>) =>
  menuResults({ ...base, ...input }).results.map((r) => r.key);

test("the page lists workspaces, then hosts most recently used first, then by name", () => {
  assert.deepEqual(keys({}), ["workspace-w1", "host-b", "host-a", "host-c"]);
  assert.equal(launcherResults(base).hasRecent, true);
});

test("a search matches the identity's user name", () => {
  assert.deepEqual(menuKeys({ query: "DEPLOY" }), ["host-c", "local"]);
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
  const { hasRecent, results } = launcherResults({ ...base, ...input });
  return groupResults(results, hasRecent).map((g) => [
    g.heading,
    g.items.map((i) => i.result.key),
  ]);
};

test("the page groups follow the history, empty ones are left out", () => {
  assert.deepEqual(groupsOf({}), [
    ["Workspace", ["workspace-w1"]],
    ["Connessioni recenti", ["host-b", "host-a", "host-c"]],
  ]);
  const never = base.hosts.map((h) => ({ ...h, lastConnectedAt: null }));
  assert.deepEqual(groupsOf({ workspaces: [], hosts: never }), [
    ["Host salvati", ["host-a", "host-b", "host-c"]],
  ]);
  assert.deepEqual(groupsOf({ workspaces: [], hosts: [] }), []);
});

test("the search menu lists hosts, open tabs and quick connect", () => {
  const tabs = [
    session("t1", "a", 2),
    { id: "t2", title: "quick", subtitle: "root@x.example", lastActive: 9 },
    session("t3", "b", 5),
  ];
  const target = { address: "a", port: 22 };
  const menu = (input: Partial<Parameters<typeof menuResults>[0]>) =>
    menuResults({ ...base, tabs, ...input }).results.map((r) => r.key);
  assert.deepEqual(menu({}), [
    "host-b",
    "host-a",
    "host-c",
    "tab-t2",
    "tab-t3",
    "tab-t1",
    "local",
  ]);
  assert.deepEqual(menu({ target }).slice(-2), ["target", "local"]);
  assert.deepEqual(menu({ query: "root@x" }), ["tab-t2", "local"]);
  assert.deepEqual(menu({ jump: true, target }), [
    "tab-t2",
    "tab-t3",
    "tab-t1",
    "target",
    "local",
  ]);
  assert.deepEqual(menu({ jump: true, tabs: [] }), ["local"]);
});

test("the target row shows the port only when it is not 22", () => {
  const title = (target: {
    address: string;
    port: number;
    username?: string;
  }) =>
    menuResults({ ...base, target }).results.find((r) => r.key === "target")
      ?.title;
  assert.equal(title({ address: "10.0.0.1", port: 22 }), "10.0.0.1");
  assert.equal(title({ address: "10.0.0.1", port: 56 }), "10.0.0.1:56");
  assert.equal(
    title({ address: "::1", port: 22, username: "root" }),
    "root@[::1]",
  );
});

test("the empty message tells why nothing is listed", () => {
  const state = {
    jump: false,
    text: "x",
    hasTarget: false,
    nothingSaved: false,
  };
  assert.match(emptyMessage(state), /corrisponde/);
  assert.match(
    emptyMessage({ ...state, invalid: true }),
    /non è un nome host/i,
  );
  assert.match(
    emptyMessage({ ...state, nothingSaved: true }),
    /Nessun host salvato/,
  );
  assert.match(
    emptyMessage({ ...state, jump: true }),
    /Nessuna scheda corrisponde/,
  );
  assert.equal(
    emptyMessage({ ...state, jump: true, text: "" }),
    "Nessuna scheda aperta.",
  );
});
