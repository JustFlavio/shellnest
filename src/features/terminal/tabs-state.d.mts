import type { Edge, LayoutNode, SavedNode } from "./workbench-state.mjs";

export type TabLike = {
  id: string;
  name?: string;
  parent?: string;
  layout?: LayoutNode;
};
export function splitPane<T extends TabLike>(
  tabs: T[],
  leaderId: string,
  paneId: string,
  clone: T,
  edge: Edge,
): T[];
export function rearrangePane<T extends TabLike>(
  tabs: T[],
  leaderId: string,
  paneId: string,
  targetId: string,
  edge: Edge,
): T[] | null;
export function joinWorkspace<T extends TabLike>(
  tabs: T[],
  leaderId: string,
  srcId: string,
  targetId: string,
  edge: Edge,
): T[] | null;
export function unlinkPane<T extends TabLike>(
  tabs: T[],
  id: string,
  keep: boolean,
): { leader: T; next: string; tabs: T[] } | null;
export function replaceTab<T extends TabLike>(
  tabs: T[],
  id: string,
  next: T,
): T[];
export function appendWorkspaces<T extends TabLike>(
  tabs: T[],
  groups: { leader: T; rest: T[]; layout: LayoutNode; name?: string }[],
): T[];
export function sessionIds(tabs: TabLike[], id: string): string[];
export function neighbourInBar(tabs: TabLike[], id: string): string | undefined;
export function parseSession(
  raw: string | null,
  knownHostIds: Set<string>,
): {
  items: { name?: string; layout: SavedNode }[];
  active: number;
  count: number;
} | null;
