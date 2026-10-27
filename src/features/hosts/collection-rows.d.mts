import type { Group, Host, Identity, SshKey } from "@/lib/types";

export function filterHosts(options: {
  hosts: Host[];
  groups: Group[];
  identities: Identity[];
  group: string;
  usageIds: Set<string> | null;
  query: string;
  sort: "name" | "recent";
}): Host[];
export function filterIdentities(options: {
  identities: Identity[];
  keys: SshKey[];
  query: string;
}): Identity[];
export function filterKeys(options: {
  keys: SshKey[];
  query: string;
}): SshKey[];
