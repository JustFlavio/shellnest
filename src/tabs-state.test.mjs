import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendWorkspaces,
  joinWorkspace,
  neighbourInBar,
  parseSession,
  rearrangePane,
  replaceTab,
  sessionIds,
  splitPane,
  unlinkPane,
} from "./tabs-state.mjs";
import { leafIds } from "./workbench-state.mjs";

const ids = (tabs) => tabs.map((t) => t.id);
const split = () => {
  const tabs = [{ id: "a" }, { id: "x" }];
  return splitPane(tabs, "a", "a", { id: "b", parent: "a" }, "right");
};

test("splitting adds the clone and starts the leader's layout", () => {
  const tabs = split();
  assert.deepEqual(ids(tabs), ["a", "x", "b"]);
  assert.deepEqual(leafIds(tabs[0].layout), ["a", "b"]);
  assert.equal(tabs[1].layout, undefined);
});

test("rearranging moves a pane inside its workspace only", () => {
  const tabs = rearrangePane(split(), "a", "b", "a", "left");
  assert.deepEqual(leafIds(tabs[0].layout), ["b", "a"]);
  assert.equal(rearrangePane(split(), "x", "b", "a", "left"), null);
});

test("joining adopts every session of the dropped tab", () => {
  let tabs = splitPane(
    [{ id: "a" }, { id: "x" }],
    "x",
    "x",
    { id: "y", parent: "x" },
    "right",
  );
  tabs = joinWorkspace(tabs, "a", "x", "a", "bottom");
  assert.deepEqual(leafIds(tabs[0].layout), ["a", "x", "y"]);
  const [, x, y] = tabs;
  assert.equal(x.parent, "a");
  assert.equal(x.layout, undefined);
  assert.equal(y.parent, "a");
  assert.equal(joinWorkspace(tabs, "a", "gone", "a", "left"), null);
});

test("unlinking keeps or drops the pane and promotes a new leader", () => {
  const kept = unlinkPane(split(), "b", true);
  assert.equal(kept.next, "a");
  assert.deepEqual(ids(kept.tabs), ["a", "x", "b"]);
  assert.equal(kept.tabs[0].layout, undefined);
  assert.equal(kept.tabs[2].parent, undefined);
  const dropped = unlinkPane(split(), "b", false);
  assert.deepEqual(ids(dropped.tabs), ["a", "x"]);
  const promoted = unlinkPane(
    [
      { id: "a", name: "Db" },
      { id: "b", parent: "a" },
    ].map((t, i) => (i ? t : { ...t, layout: split()[0].layout })),
    "a",
    false,
  );
  assert.equal(promoted.next, "b");
  assert.equal(promoted.tabs[0].name, "Db");
  assert.equal(promoted.tabs[0].parent, undefined);
  assert.equal(unlinkPane(split(), "x", false), null);
});

test("replacing a tab rewires panes and layouts that point to it", () => {
  const tabs = replaceTab(split(), "a", { id: "n", layout: split()[0].layout });
  assert.equal(tabs[2].parent, "n");
  const pane = replaceTab(split(), "b", { id: "n", parent: "a" });
  assert.deepEqual(leafIds(pane[0].layout), ["a", "n"]);
});

test("workspaces are appended with their panes under the leader", () => {
  const tabs = appendWorkspaces(
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
  const tabs = [{ id: "a" }, { id: "b", parent: "a" }, { id: "c" }];
  assert.equal(neighbourInBar(tabs, "a"), "c");
  assert.equal(neighbourInBar(tabs, "c"), "a");
  assert.equal(neighbourInBar([{ id: "a" }], "a"), undefined);
});

test("a stored session drops hosts that no longer exist", () => {
  const raw = JSON.stringify({
    active: 1,
    items: [
      { name: "One", layout: { hostId: "h1" } },
      { layout: { hostId: "gone" } },
      {
        layout: {
          dir: "row",
          ratio: 0.5,
          a: { hostId: "h1" },
          b: { local: true },
        },
      },
    ],
  });
  const session = parseSession(raw, new Set(["h1"]));
  assert.equal(session.items.length, 2);
  assert.equal(session.active, 1);
  assert.equal(session.count, 3);
  assert.equal(parseSession("{", new Set()), null);
  assert.equal(parseSession(null, new Set()), null);
  assert.equal(parseSession(raw, new Set()).items.length, 1);
});
