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
  onRestore: (hosts: Host[]) => void;
  onCreateWorkspace: (hostIds: string[]) => void;
  onActivateTab: (id: string) => void;
  onLocalTerminal: () => void;
  onQuickConnect: (target: ConnectionTarget) => void;
  preview: boolean;
  // "jump" opens the search menu scoped to the open tabs and quick connect
  mode: "search" | "jump";
  // formatted bindings of the quick-connect and jump shortcuts; empty when unbound
  shortcut: string;
  jumpShortcut: string;
  busy: boolean;
};
