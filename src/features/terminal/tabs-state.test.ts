import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendWorkspaces,
  closedRecords,
  joinWorkspace,
  neighbourInBar,
  planWorkspaces,
  rearrangePane,
  replaceTab,
  sessionIds,
  setTermTitle,
  splitPane,
  unlinkPane,
  workspaceTemplate,
} from "./tabs-state.ts";
import type { TabLike } from "./tabs-state.ts";
import { leafIds } from "./workbench-state.ts";
import type { LayoutNode, SavedNode } from "./workbench-state.ts";
import type { Host } from "../../lib/types.ts";

function defined<V>(value: V | null | undefined): V {
  assert.ok(value);
  return value;
}

const ids = (tabs: TabLike[]) => tabs.map((t) => t.id);
const split = () => {
  const tabs: TabLike[] = [{ id: "a" }, { id: "x" }];
  return splitPane(tabs, "a", "a", { id: "b", parent: "a" }, "right");
};

test("splitting adds the clone and starts the leader's layout", () => {
  const tabs = split();
  assert.deepEqual(ids(tabs), ["a", "x", "b"]);
  assert.deepEqual(leafIds(defined(tabs[0].layout)), ["a", "b"]);
  assert.equal(tabs[1].layout, undefined);
});

test("rearranging moves a pane inside its workspace only", () => {
  const tabs = defined(rearrangePane(split(), "a", "b", "a", "left"));
  assert.deepEqual(leafIds(defined(tabs[0].layout)), ["b", "a"]);
  assert.equal(rearrangePane(split(), "x", "b", "a", "left"), null);
});

test("joining adopts every session of the dropped tab", () => {
  let tabs = splitPane<TabLike>(
    [{ id: "a" }, { id: "x" }],
    "x",
    "x",
    { id: "y", parent: "x" },
    "right",
  );
  tabs = defined(joinWorkspace(tabs, "a", "x", "a", "bottom"));
  assert.deepEqual(leafIds(defined(tabs[0].layout)), ["a", "x", "y"]);
  const [, x, y] = tabs;
  assert.equal(x.parent, "a");
  assert.equal(x.layout, undefined);
  assert.equal(y.parent, "a");
  assert.equal(joinWorkspace(tabs, "a", "gone", "a", "left"), null);
});

test("unlinking keeps or drops the pane and promotes a new leader", () => {
  const kept = defined(unlinkPane(split(), "b", true));
  assert.equal(kept.next, "a");
  assert.deepEqual(ids(kept.tabs), ["a", "x", "b"]);
  assert.equal(kept.tabs[0].layout, undefined);
  assert.equal(kept.tabs[2].parent, undefined);
  const dropped = defined(unlinkPane(split(), "b", false));
  assert.deepEqual(ids(dropped.tabs), ["a", "x"]);
  const promoted = unlinkPane(
    (
      [
        { id: "a", name: "Db" },
        { id: "b", parent: "a" },
      ] as TabLike[]
    ).map((t, i) => (i ? t : { ...t, layout: split()[0].layout })),
    "a",
    false,
  );
  const next = defined(promoted);
  assert.equal(next.next, "b");
  assert.equal(next.tabs[0].name, "Db");
  assert.equal(next.tabs[0].parent, undefined);
  assert.equal(unlinkPane(split(), "x", false), null);
});

test("replacing a tab rewires panes and layouts that point to it", () => {
  const tabs = replaceTab(split(), "a", { id: "n", layout: split()[0].layout });
  assert.equal(tabs[2].parent, "n");
  const pane = replaceTab(split(), "b", { id: "n", parent: "a" });
  assert.deepEqual(leafIds(defined(pane[0].layout)), ["a", "n"]);
});

test("workspaces are appended with their panes under the leader", () => {
  const tabs = appendWorkspaces<TabLike>(
    [{ id: "x" }],
    [
      {
        leader: { id: "a" },
        rest: [{ id: "b" }],
        layout: { id: "a" },
        name: "Db",
      },
      { leader: { id: "c" }, rest: [], layout: { id: "c" }, name: undefined },
    ],
  );
  assert.deepEqual(ids(tabs), ["x", "a", "b", "c"]);
  assert.equal(tabs[1].name, "Db");
  assert.equal(tabs[2].parent, "a");
  assert.equal(tabs[3].layout, undefined);
});

test("closing resolves workspace sessions and the next tab", () => {
  assert.deepEqual(sessionIds(split(), "a"), ["a", "b"]);
  assert.deepEqual(sessionIds(split(), "x"), ["x"]);
  const tabs: TabLike[] = [{ id: "a" }, { id: "b", parent: "a" }, { id: "c" }];
  assert.equal(neighbourInBar(tabs, "a"), "c");
  assert.equal(neighbourInBar(tabs, "c"), "a");
  assert.equal(neighbourInBar([{ id: "a" }], "a"), undefined);
});

test("closed sessions lose their place in a workspace", () => {
  const tabs: (TabLike & { kind?: string })[] = [
    { id: "a", layout: { id: "a" } },
    { id: "b", parent: "a", kind: "local" },
    { id: "c" },
  ];
  assert.deepEqual(closedRecords(tabs, ["a", "b"]), [
    { id: "a" },
    { id: "b", kind: "local" },
  ]);
});

test("a title change returns a new list only when something changed", () => {
  const tabs: (TabLike & { termTitle?: string })[] = [
    { id: "a", termTitle: "vim" },
    { id: "b" },
  ];
  assert.equal(setTermTitle(tabs, "a", "vim"), tabs);
  assert.equal(setTermTitle(tabs, "gone", "x"), tabs);
  assert.equal(setTermTitle(tabs, "a", undefined)[0].termTitle, undefined);
});

test("only a split of saveable sessions becomes a workspace template", () => {
  const tabs: Parameters<typeof workspaceTemplate>[0] = [
    { id: "a", kind: "ssh", host: { id: "h1" } },
    { id: "b", kind: "local" },
    { id: "c", kind: "quick" },
  ];
  const row = (a: string, b: string): LayoutNode => ({
    dir: "row",
    ratio: 0.5,
    a: { id: a },
    b: { id: b },
  });
  assert.deepEqual(workspaceTemplate(tabs, row("a", "b")), {
    dir: "row",
    ratio: 0.5,
    a: { hostId: "h1" },
    b: { local: true },
  });
  assert.equal(workspaceTemplate(tabs, row("a", "c")), null);
  assert.equal(workspaceTemplate(tabs, { id: "a" }), null);
});

test("planning workspaces flags missing and untrusted hosts", () => {
  const hosts = new Map([
    ["h1", { id: "h1", fingerprint: "fp" } as Host],
    ["h2", { id: "h2" } as Host],
  ]);
  let n = 0;
  const newId = () => `s${n++}`;
  const row = (a: SavedNode, b: SavedNode): SavedNode => ({
    dir: "row",
    ratio: 0.5,
    a,
    b,
  });
  const ok = planWorkspaces(
    [{ name: "W", layout: row({ hostId: "h1" }, { local: true }) }],
    hosts,
    newId,
  );
  assert.deepEqual(
    ok.built[0].specs.map((s) => s.id),
    ["s0", "s1"],
  );
  assert.equal(ok.missing, false);
  assert.equal(ok.untrusted, undefined);
  const mixed = planWorkspaces(
    [{ layout: row({ hostId: "h2" }, { hostId: "h1" }) }],
    hosts,
    newId,
  );
  assert.equal(mixed.untrusted?.id, "h2");
  assert.equal(
    planWorkspaces([{ layout: { hostId: "gone" } }], hosts, newId).missing,
    true,
  );
});

test("broadcast ends when the workspace is back to one pane and survives otherwise", () => {
  const three = [
    {
      id: "a",
      broadcast: true,
      layout: {
        dir: "row" as const,
        ratio: 0.5,
        a: { id: "a" },
        b: {
          dir: "col" as const,
          ratio: 0.5,
          a: { id: "b" },
          b: { id: "c" },
        },
      },
    },
    { id: "b", parent: "a" },
    { id: "c", parent: "a" },
  ];
  const two = defined(unlinkPane(three, "c", false));
  assert.equal(two.tabs[0].broadcast, true);
  const promoted = defined(unlinkPane(three, "a", false));
  assert.equal(promoted.tabs.find((t) => t.id === "b")?.broadcast, true);
  const one = defined(unlinkPane(two.tabs, "b", false));
  assert.equal(one.tabs[0].broadcast, undefined);
  assert.equal(one.tabs[0].layout, undefined);
  const detached = defined(unlinkPane(two.tabs, "b", true));
  assert.equal(
    detached.tabs.every((t) => !t.broadcast),
    true,
  );
});
