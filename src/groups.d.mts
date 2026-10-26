export type GroupLike = {
  id: string;
  name: string;
  parentId: string;
  identityId: string;
  port: number | null;
};
export const MAX_GROUP_DEPTH: number;
export function ancestry<T extends GroupLike>(groups: T[], id: string): T[];
export function groupPath(groups: GroupLike[], id: string): string;
export function depthOf(groups: GroupLike[], id: string): number;
export function childGroups<T extends GroupLike>(
  groups: T[],
  parentId: string,
): T[];
export function subtreeIds(groups: GroupLike[], id: string): string[];
export function inheritedIdentity<T extends GroupLike>(
  groups: T[],
  groupId: string,
): T | undefined;
export function portSource<T extends GroupLike>(
  groups: T[],
  groupId: string,
): T | undefined;
export function inheritedPort(
  groups: GroupLike[],
  groupId: string,
): number | null;
export function resolveHost(
  groups: GroupLike[],
  host: {
    groupId: string;
    identityId: string;
    ownPort: number | null;
    username?: string | null;
  },
): { port: number; effectiveIdentityId: string; identitySource: string };
export function groupOptions<T extends GroupLike>(
  groups: T[],
  parentId?: string,
  skip?: Set<string>,
): { group: T; path: string }[];
