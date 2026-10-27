import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_WORKSPACE_HOSTS,
  launcherResults,
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
  tabs: [{ id: "t1", title: "web", subtitle: "root@web.example" }],
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
