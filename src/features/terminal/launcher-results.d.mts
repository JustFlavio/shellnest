import type { Group, Host, Identity, Workspace } from "@/lib/types";

export type LauncherTab = { id: string; title: string; subtitle?: string };
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
