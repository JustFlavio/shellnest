export function reorderTabs<T extends { id: string }>(
  tabs: T[],
  movingId: string,
  targetId: string,
): T[];
export function terminalInputChunks(text: string): string[];
export function syncUrlForVault(raw: string, vaultId: string): string;
export type LayoutNode =
  | { id: string }
  | { dir: "row" | "col"; ratio: number; a: LayoutNode; b: LayoutNode };
export type Box = { x: number; y: number; w: number; h: number };
export type Divider = {
  path: string;
  dir: "row" | "col";
  box: Box;
  at: number;
};
export function leafIds(node: LayoutNode): string[];
export type Edge = "left" | "right" | "top" | "bottom";
export function insertLeaf(
  layout: LayoutNode,
  targetId: string,
  node: LayoutNode,
  edge: Edge,
): LayoutNode;
export function dropEdge(
  x: number,
  y: number,
  w: number,
  h: number,
): Edge | null;
export function removeLeaf(node: LayoutNode, id: string): LayoutNode | null;
export function layoutRects(
  node: LayoutNode,
  box?: Box,
  path?: string,
): { panes: Record<string, Box>; dividers: Divider[] };
export function setRatio(
  node: LayoutNode,
  path: string,
  ratio: number,
): LayoutNode;
export function replaceLeaf(
  node: LayoutNode,
  oldId: string,
  newId: string,
): LayoutNode;
export type SavedNode =
  | { hostId: string }
  | { local: true }
  | { dir: "row" | "col"; ratio: number; a: SavedNode; b: SavedNode };
export function toTemplate(
  node: LayoutNode,
  describe: (id: string) => ({ hostId: string } | { local: true }) | null,
): SavedNode | null;
export function fromTemplate(
  node: SavedNode,
  newId: () => string,
): {
  layout: LayoutNode;
  leaves: { id: string; spec: { hostId: string } | { local: true } }[];
};
export function pruneTemplate(
  node: SavedNode,
  keep: (leaf: { hostId: string } | { local: true }) => boolean,
): SavedNode | null;
export function gridLayout<T extends SavedNode>(leaves: T[]): SavedNode;
export function snapshotSession(
  tabs: {
    id: string;
    parent?: string;
    name?: string;
    layout?: LayoutNode;
    kind: string;
    host?: { id: string };
  }[],
  activeId: string,
): { items: { name?: string; layout: SavedNode }[]; active: number };
