import type { Group } from "../../lib/types.ts";

type GroupRef = Pick<Group, "id" | "name" | "parentId">;

// Folder helpers shared by the UI and the browser preview; the desktop backend applies the same rules.
export const MAX_GROUP_DEPTH = 5;
// The group and its ancestors, nearest first.
export function ancestry<T extends GroupRef>(groups: T[], id: string): T[] {
  const chain: T[] = [];
  for (let at = id; at && chain.length <= MAX_GROUP_DEPTH;) {
    const group = groups.find((g) => g.id === at);
    if (!group) break;
    chain.push(group);
    at = group.parentId;
  }
  return chain;
}
export function groupPath(groups: GroupRef[], id: string): string {
  return ancestry(groups, id)
    .reverse()
    .map((g) => g.name)
    .join(" / ");
}
export function depthOf(groups: GroupRef[], id: string): number {
  return ancestry(groups, id).length;
}
export function childGroups<T extends GroupRef>(
  groups: T[],
  parentId: string,
): T[] {
  return groups
    .filter((g) => g.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
// The group and everything below it.
export function subtreeIds(groups: GroupRef[], id: string): string[] {
  const ids = [id];
  for (const g of groups)
    if (g.parentId === id) ids.push(...subtreeIds(groups, g.id));
  return ids;
}
export function inheritedIdentity<T extends Group>(
  groups: T[],
  groupId: string,
): T | undefined {
  return ancestry(groups, groupId).find((g) => g.identityId);
}
// The nearest group, itself included, that sets a default port.
export function portSource<T extends Group>(
  groups: T[],
  groupId: string,
): T | undefined {
  return ancestry(groups, groupId).find((g) => g.port);
}
export function inheritedPort(groups: Group[], groupId: string): number | null {
  return portSource(groups, groupId)?.port ?? null;
}
// Effective port and identity of a host; a host with credentials of its own inherits no identity.
export function resolveHost(
  groups: Group[],
  host: {
    groupId: string;
    identityId: string;
    ownPort: number | null;
    username?: string | null;
  },
): { port: number; effectiveIdentityId: string; identitySource: string } {
  const own = !!host.identityId || !!host.username;
  const source = own ? undefined : inheritedIdentity(groups, host.groupId);
  return {
    port: host.ownPort ?? inheritedPort(groups, host.groupId) ?? 22,
    effectiveIdentityId: host.identityId || source?.identityId || "",
    identitySource: source?.id ?? "",
  };
}
// Every group with its path, depth-first by name, for pickers.
export function groupOptions<T extends Group>(
  groups: T[],
  parentId = "",
  skip: Set<string> = new Set(),
): { group: T; path: string }[] {
  return childGroups(groups, parentId).flatMap((g) =>
    skip.has(g.id)
      ? []
      : [
          { group: g, path: groupPath(groups, g.id) },
          ...groupOptions(groups, g.id, skip),
        ],
  );
}
