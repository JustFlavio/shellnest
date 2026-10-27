// Folder helpers shared by the UI and the browser preview; the desktop backend applies the same rules.
export const MAX_GROUP_DEPTH = 5;
// The group and its ancestors, nearest first.
export function ancestry(groups, id) {
  const chain = [];
  for (let at = id; at && chain.length <= MAX_GROUP_DEPTH;) {
    const group = groups.find((g) => g.id === at);
    if (!group) break;
    chain.push(group);
    at = group.parentId;
  }
  return chain;
}
export function groupPath(groups, id) {
  return ancestry(groups, id)
    .reverse()
    .map((g) => g.name)
    .join(" / ");
}
export function depthOf(groups, id) {
  return ancestry(groups, id).length;
}
export function childGroups(groups, parentId) {
  return groups
    .filter((g) => g.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
// The group and everything below it.
export function subtreeIds(groups, id) {
  const ids = [id];
  for (const g of groups)
    if (g.parentId === id) ids.push(...subtreeIds(groups, g.id));
  return ids;
}
export function inheritedIdentity(groups, groupId) {
  return ancestry(groups, groupId).find((g) => g.identityId);
}
// The nearest group, itself included, that sets a default port.
export function portSource(groups, groupId) {
  return ancestry(groups, groupId).find((g) => g.port);
}
export function inheritedPort(groups, groupId) {
  return portSource(groups, groupId)?.port ?? null;
}
// Effective port and identity of a host; a host with credentials of its own inherits no identity.
export function resolveHost(groups, host) {
  const own = !!host.identityId || !!host.username;
  const source = own ? undefined : inheritedIdentity(groups, host.groupId);
  return {
    port: host.ownPort ?? inheritedPort(groups, host.groupId) ?? 22,
    effectiveIdentityId: host.identityId || source?.identityId || "",
    identitySource: source?.id ?? "",
  };
}
// Every group with its path, depth-first by name, for pickers.
export function groupOptions(groups, parentId = "", skip = new Set()) {
  return childGroups(groups, parentId).flatMap((g) =>
    skip.has(g.id)
      ? []
      : [
          { group: g, path: groupPath(groups, g.id) },
          ...groupOptions(groups, g.id, skip),
        ],
  );
}
