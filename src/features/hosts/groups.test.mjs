import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ancestry,
  childGroups,
  depthOf,
  groupOptions,
  groupPath,
  inheritedIdentity,
  resolveHost,
  subtreeIds,
} from "./groups.mjs";

const g = (id, name, parentId = "", extra = {}) => ({
  id,
  name,
  parentId,
  identityId: "",
  port: null,
  ...extra,
});
const groups = [
  g("prod", "Produzione", "", { identityId: "deploy", port: 2200 }),
  g("api", "Api", "prod", { identityId: "root" }),
  g("web", "Web", "prod"),
  g("stg", "Staging"),
];

test("paths, depth and subtrees follow parent links", () => {
  assert.equal(groupPath(groups, "api"), "Produzione / Api");
  assert.equal(depthOf(groups, "api"), 2);
  assert.deepEqual(
    ancestry(groups, "web").map((x) => x.id),
    ["web", "prod"],
  );
  assert.deepEqual(subtreeIds(groups, "prod").sort(), ["api", "prod", "web"]);
  assert.deepEqual(
    childGroups(groups, "prod").map((x) => x.name),
    ["Api", "Web"],
  );
  assert.deepEqual(
    groupOptions(groups).map((o) => o.path),
    ["Produzione", "Produzione / Api", "Produzione / Web", "Staging"],
  );
  assert.deepEqual(
    groupOptions(groups, "", new Set(["prod"])).map((o) => o.path),
    ["Staging"],
  );
});

test("hosts take the nearest group's identity and port unless they set their own", () => {
  const base = { identityId: "", ownPort: null, username: null };
  assert.deepEqual(resolveHost(groups, { ...base, groupId: "api" }), {
    port: 2200,
    effectiveIdentityId: "root",
    identitySource: "api",
  });
  assert.equal(
    resolveHost(groups, { ...base, groupId: "web" }).effectiveIdentityId,
    "deploy",
  );
  assert.equal(resolveHost(groups, { ...base, groupId: "stg" }).port, 22);
  assert.deepEqual(
    resolveHost(groups, {
      ...base,
      groupId: "api",
      identityId: "mine",
      ownPort: 22,
    }),
    { port: 22, effectiveIdentityId: "mine", identitySource: "" },
  );
  assert.equal(
    resolveHost(groups, { ...base, groupId: "api", username: "me" })
      .identitySource,
    "",
  );
  assert.equal(inheritedIdentity(groups, "stg"), undefined);
});
