export type Host = {
  id: string;
  name: string;
  address: string;
  port: number;
  group: string;
  identityId: string;
  username?: string | null;
  hasPassword?: boolean;
  fingerprint: string;
  os?: string | null;
  lastConnectedAt?: number | null;
};
export type HostCredentials = { username: string; password: string };
export type HostDraft = Host & {
  credentials?: HostCredentials;
};
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
  syncUrl: string;
  syncConfigured: boolean;
  dirty: boolean;
};
export type VaultInfo = { id: string; name: string; exists: boolean };
export type QuickTarget = {
  address: string;
  port: number;
  identityId: string;
  username?: string;
  expectedFingerprint: string;
};
export type TerminalTab = {
  id: string;
  vaultId: string;
  title: string;
  username: string;
  identityName: string;
  status?: "connecting" | "connected" | "closed" | "failed";
  error?: string;
} & (
  | { kind: "ssh"; host: Host }
  | { kind: "quick"; target: QuickTarget }
  | { kind: "local" }
);
export type Output =
  | { type: "data"; data: number[] }
  | { type: "status" | "error"; data: string }
  | { type: "metadata"; data: { os: string | null; lastConnectedAt: number } }
  | { type: "closed" };
export const emptyView: View = {
  vaultId: "personal",
  vaultName: "Personale",
  vaults: [{ id: "personal", name: "Personale", exists: false }],
  exists: false,
  unlocked: false,
  hosts: [],
  identities: [],
  keys: [],
  syncUrl: "",
  syncConfigured: false,
  dirty: false,
};
export const newHost = (): HostDraft => ({
  id: crypto.randomUUID(),
  name: "",
  address: "",
  port: 22,
  group: "",
  identityId: "",
  fingerprint: "",
  credentials: { username: "", password: "" },
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
