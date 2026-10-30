import type { Group, Host, Identity, SshKey } from "../../lib/types.ts";
import { groupPath } from "./groups.ts";

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

type HostRow = Pick<
  Host,
  | "tags"
  | "name"
  | "address"
  | "groupId"
  | "identityId"
  | "effectiveIdentityId"
  | "username"
  | "lastConnectedAt"
>;

export function filterHosts<T extends HostRow>({
  hosts,
  groups,
  identities,
  group,
  usageIds,
  query,
  sort,
}: {
  hosts: T[];
  groups: Pick<Group, "id" | "name" | "parentId">[];
  identities: Pick<Identity, "id" | "name" | "username">[];
  group: string;
  usageIds: Set<string> | null;
  query: string;
  sort: "name" | "recent";
}): T[] {
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
          `${h.name} ${(h.tags ?? []).join(" ")} ${h.address} ${groupPath(groups, h.groupId)} ${identity?.name ?? ""} ${identity?.username ?? h.username ?? ""}`,
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

export function filterIdentities<
  T extends Pick<Identity, "name" | "username" | "keyId">,
>({
  identities,
  keys,
  query,
}: {
  identities: T[];
  keys: Pick<SshKey, "id" | "name">[];
  query: string;
}): T[] {
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

export function filterKeys<T extends Pick<SshKey, "name" | "fingerprint">>({
  keys,
  query,
}: {
  keys: T[];
  query: string;
}): T[] {
  return keys
    .filter((k) => matches(`${k.name} ${k.fingerprint}`, query))
    .sort((a, b) => a.name.localeCompare(b.name));
}
