import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterHosts,
  filterIdentities,
  filterKeys,
} from "./collection-rows.ts";
import type { Host } from "../../lib/types.ts";

const host = (id: string, name: string, extra: Partial<Host> = {}) => ({
  id,
  name,
  address: `${id}.example.com`,
  groupId: "",
  identityId: "",
  effectiveIdentityId: "",
  username: "",
  lastConnectedAt: null,
  ...extra,
});
const base = {
  groups: [{ id: "prod", name: "Produzione", parentId: "" }],
  identities: [{ id: "adm", name: "Admin", username: "root", keyId: "k1" }],
  group: "",
  usageIds: null,
  query: "",
  sort: "name" as "name" | "recent",
};

test("hosts match name, address, group path and identity", () => {
  const hosts = [
    host("a", "Alpha", { groupId: "prod" }),
    host("b", "Beta", { identityId: "adm" }),
  ];
  const names = (query: string) =>
    filterHosts({ ...base, hosts, query }).map((h) => h.name);
  assert.deepEqual(names("produzione"), ["Alpha"]);
  assert.deepEqual(names("root"), ["Beta"]);
  assert.deepEqual(names("b.example"), ["Beta"]);
});

test("hosts filter by folder and identity usage", () => {
  const hosts = [
    host("a", "Alpha", { groupId: "prod", identityId: "adm" }),
    host("b", "Beta", { identityId: "adm" }),
  ];
  assert.deepEqual(
    filterHosts({ ...base, hosts, group: "prod" }).map((h) => h.id),
    ["a"],
  );
  assert.deepEqual(
    filterHosts({ ...base, hosts, usageIds: new Set(["none"]) }),
    [],
  );
});

test("hosts sort by name with numbers, or by recent use", () => {
  const hosts = [
    host("a", "srv10", { lastConnectedAt: 1 }),
    host("b", "srv2", { lastConnectedAt: 5 }),
  ];
  const ids = (sort: "name" | "recent") =>
    filterHosts({ ...base, hosts, sort }).map((h) => h.id);
  assert.deepEqual(ids("name"), ["b", "a"]);
  assert.deepEqual(ids("recent"), ["b", "a"]);
  assert.deepEqual(
    filterHosts({ ...base, hosts: hosts.reverse(), sort: "recent" }).map(
      (h) => h.id,
    ),
    ["b", "a"],
  );
});

test("identities match their key name, keys match fingerprints", () => {
  const keys = [{ id: "k1", name: "Laptop", fingerprint: "SHA256:abc" }];
  const identities = base.identities;
  assert.equal(
    filterIdentities({ identities, keys, query: "laptop" }).length,
    1,
  );
  assert.equal(filterIdentities({ identities, keys, query: "zzz" }).length, 0);
  assert.equal(filterKeys({ keys, query: "sha256" }).length, 1);
});
