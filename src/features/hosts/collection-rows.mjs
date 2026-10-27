import { groupPath } from "./groups.mjs";

const matches = (text, query) =>
  text.toLowerCase().includes(query.toLowerCase());

export function filterHosts({
  hosts,
  groups,
  identities,
  group,
  usageIds,
  query,
  sort,
}) {
  const identitiesById = new Map(identities.map((i) => [i.id, i]));
  return hosts
    .filter((h) => {
      const identity = identitiesById.get(
        h.effectiveIdentityId || h.identityId,
      );
      return (
        (!group || h.groupId === group) &&
        (!usageIds || usageIds.has(h.identityId)) &&
        matches(
          `${h.name} ${h.address} ${groupPath(groups, h.groupId)} ${identity?.name ?? ""} ${identity?.username ?? h.username ?? ""}`,
          query,
        )
      );
    })
    .sort((a, b) =>
      sort === "recent"
        ? (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0)
        : a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
}

export function filterIdentities({ identities, keys, query }) {
  const keysById = new Map(keys.map((k) => [k.id, k]));
  return identities
    .filter((i) =>
      matches(
        `${i.name} ${i.username} ${keysById.get(i.keyId)?.name ?? ""}`,
        query,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterKeys({ keys, query }) {
  return keys
    .filter((k) => matches(`${k.name} ${k.fingerprint}`, query))
    .sort((a, b) => a.name.localeCompare(b.name));
}
