import type { Group, Host, Identity, Workspace } from "@/lib/types";

export type LauncherTab = {
  id: string;
  title: string;
  subtitle?: string;
  // the saved host this tab is a session of; absent for quick and local tabs
  hostId?: string;
  // saved hosts in the panes of this tab's split workspace
  paneHostIds?: string[];
  // when the tab was last shown; larger is newer
  lastActive: number;
};
export type RecentHost = Host & {
  lastConnectedAt?: number | null;
  os?: string | null;
};
export type LauncherResult = {
  key: string;
  kind: "workspace" | "tab" | "host";
  title: string;
  path: string;
  os?: string | null;
  workspace?: Workspace;
  tab?: LauncherTab;
  host?: RecentHost;
  // for a host: the open tab that row switches to
  openTab?: LauncherTab;
};
export const MAX_WORKSPACE_HOSTS: number;
export function workspaceSize(workspace: Workspace): number;
export function togglePicked(
  picked: string[] | null,
  id: string,
): string[] | null;
export function launcherResults(input: {
  query: string;
  vaultName: string;
  groups: Group[];
  hosts: RecentHost[];
  identities: Identity[];
  workspaces: Workspace[];
  tabs: LauncherTab[];
  selecting: boolean;
}): { text: string; hasRecent: boolean; results: LauncherResult[] };
export type LauncherKeyAction =
  { type: "clear" | "activate" | "quick" | "reveal" } | { type: "select"; index: number };
export function launcherKeyAction(
  key: string,
  state: {
    count: number;
    selected: number;
    busy: boolean;
    // the typed text is a target the card shows for, and nothing blocks connecting
    canQuickConnect: boolean;
    // Cmd/Ctrl is held
    modified?: boolean;
    hasText?: boolean;
    // an identity is picked
    ready?: boolean;
  },
): LauncherKeyAction | null;
export function listHeading(state: {
  picking: boolean;
  text: string;
  hasRecent: boolean;
}): string;
