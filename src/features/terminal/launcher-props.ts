import type { Group, Host, Identity, Workspace } from "../../lib/types.ts";
import type { ConnectionTarget } from "./connection-target.ts";
import type { LauncherTab, RecentHost } from "./launcher-results.ts";

export type ConnectionLauncherProps = {
  vaultName: string;
  groups: Group[];
  hosts: RecentHost[];
  identities: Identity[];
  workspaces: Workspace[];
  tabs: LauncherTab[];
  onConnect: (host: Host) => void;
  onOpenWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  session: { count: number } | null;
  onRestore: () => void;
  onCreateWorkspace: (hostIds: string[]) => void;
  onActivateTab: (id: string) => void;
  onLocalTerminal: () => void;
  onQuickConnect: (target: ConnectionTarget) => void;
  preview: boolean;
  // "jump" lists the open tabs only
  mode: "search" | "jump";
  // formatted binding of the quick-connect shortcut; empty when unbound
  shortcut: string;
  busy: boolean;
};
