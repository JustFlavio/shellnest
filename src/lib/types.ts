import type { Message } from "@/i18n/message";
import type {
  LayoutNode,
  SavedNode,
} from "@/features/terminal/workbench-state.ts";
export type Host = {
  id: string;
  name: string;
  address: string;
  // Effective port; ownPort is null when it comes from a folder or the 22 default.
  port: number;
  ownPort: number | null;
  groupId: string;
  // Own identity; empty when the host uses its own credentials or inherits from its folder.
  identityId: string;
  effectiveIdentityId: string;
  // The folder an inherited identity comes from, empty otherwise.
  identitySource: string;
  username?: string | null;
  hasPassword?: boolean;
  fingerprint: string;
  os?: string | null;
  lastConnectedAt?: number | null;
};
export type HostCredentials = { username: string; password: string };
export type HostDraft = Host & {
  credentials?: HostCredentials;
  // No identity or credentials of its own: use the folder's identity.
  inheritIdentity?: boolean;
};
export type Group = {
  id: string;
  name: string;
  parentId: string;
  identityId: string;
  port: number | null;
};
export type GroupForm = Group & { returnTo?: string };
export type Identity = {
  id: string;
  name: string;
  username: string;
  auth: "key" | "password";
  keyId: string;
  hasPassword: boolean;
  hostCount: number;
};
export type SshKey = {
  id: string;
  name: string;
  fingerprint: string;
  identityCount: number;
  hostCount: number;
};
export type IdentityForm = Pick<
  Identity,
  "id" | "name" | "username" | "auth" | "keyId"
> & { password: string };
export type KeyForm = Pick<SshKey, "id" | "name"> & {
  privateKey: string;
  passphrase: string;
  fingerprint: string;
};
export type View = {
  vaultId: string;
  vaultName: string;
  vaults: VaultInfo[];
  exists: boolean;
  unlocked: boolean;
  hosts: Host[];
  identities: Identity[];
  keys: SshKey[];
  groups: Group[];
  workspaces: Workspace[];
  syncUrl: string;
  syncConfigured: boolean;
  dirty: boolean;
};
export type WorkspaceDraft = { name?: string; layout: SavedNode };
export type Workspace = WorkspaceDraft & { id: string; name: string };
type VaultInfo = { id: string; name: string; exists: boolean };
/** How a quick connection logs in: a saved identity, a key from the vault, or a password. */
export type QuickLogin =
  | { kind: "identity"; id: string }
  | { kind: "key"; id: string }
  | { kind: "password" };
type QuickTarget = {
  address: string;
  port: number;
  username?: string;
  // unset while the timeline still asks for it
  login?: QuickLogin;
  // empty until the host key is confirmed; quick connections never keep it
  expectedFingerprint: string;
};
export type TerminalTab = {
  id: string;
  vaultId: string;
  title: string;
  username: string;
  identityName: string;
  status?: "connecting" | "connected" | "closed" | "failed";
  error?: Message;
  // pane of another tab's split workspace; hidden from the tab bar
  // user-chosen tab name; overrides the title (or "Workspace" when split)
  name?: string;
  // title the terminal set itself (OSC 0/2); a user-chosen name wins
  termTitle?: string;
  parent?: string;
  layout?: LayoutNode;
} & (
  | { kind: "ssh"; host: Host }
  | { kind: "quick"; target: QuickTarget }
  | { kind: "local" }
);
export type Output =
  | { type: "data"; data: number[] }
  // status is a stage id; error and log are coded messages the UI translates
  | { type: "status"; data: string }
  | { type: "error" | "log"; data: Message }
  // how a timeline step ended; warn = a partial result, such as a fallback
  | { type: "detail"; data: { step: string; warn: boolean; text: Message } }
  // authentication needs a password; data = the previous one was refused
  | { type: "password"; data: boolean }
  | { type: "metadata"; data: { os: string | null; lastConnectedAt: number } }
  | { type: "closed" };
export const emptyView: View = {
  vaultId: "personal",
  vaultName: "Personal",
  vaults: [{ id: "personal", name: "Personal", exists: false }],
  exists: false,
  unlocked: false,
  hosts: [],
  identities: [],
  keys: [],
  groups: [],
  workspaces: [],
  syncUrl: "",
  syncConfigured: false,
  dirty: false,
};
export const newHost = (groupId = ""): HostDraft => ({
  id: crypto.randomUUID(),
  name: "",
  address: "",
  port: 22,
  ownPort: null,
  groupId,
  identityId: "",
  effectiveIdentityId: "",
  identitySource: "",
  fingerprint: "",
  credentials: { username: "", password: "" },
});
export const newGroup = (parentId = "", name = ""): GroupForm => ({
  id: crypto.randomUUID(),
  name,
  parentId,
  identityId: "",
  port: null,
});
export const newIdentity = (): IdentityForm => ({
  id: crypto.randomUUID(),
  name: "",
  username: "root",
  auth: "key",
  keyId: "",
  password: "",
});
export const newKey = (): KeyForm => ({
  id: crypto.randomUUID(),
  name: "",
  privateKey: "",
  passphrase: "",
  fingerprint: "",
});
