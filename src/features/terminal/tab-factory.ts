import type { Host, Identity, TerminalTab } from "@/lib/types";

export function sshTab(
  host: Host,
  identity: Identity | undefined,
  vaultId: string,
  id: string = crypto.randomUUID(),
): TerminalTab {
  if (!identity && !(host.username && host.hasPassword))
    throw new Error("Inserisci le credenziali dell’host o scegli un’identità.");
  return {
    id,
    kind: "ssh",
    host,
    vaultId,
    title: host.name,
    status: "connecting",
    username: identity?.username ?? host.username!,
    identityName: identity?.name ?? "Credenziali dell’host",
  };
}

export function localTab(
  vaultId: string,
  id: string = crypto.randomUUID(),
): TerminalTab {
  return {
    id,
    kind: "local",
    vaultId,
    title: "Terminale locale",
    username: "",
    identityName: "",
    status: "connecting",
  };
}

/** A quick connection to a bare address: the timeline asks for user and login before anything is sent. */
export function quickTab(
  target: { address: string; port: number; username?: string },
  vaultId: string,
): TerminalTab {
  return {
    id: crypto.randomUUID(),
    kind: "quick",
    vaultId,
    title: target.address,
    username: target.username ?? "",
    identityName: "",
    // Only the address: whatever login an earlier attempt chose is asked again.
    target: {
      address: target.address,
      port: target.port,
      ...(target.username ? { username: target.username } : {}),
      expectedFingerprint: "",
    },
    status: "connecting",
  };
}

export function restarted(tab: TerminalTab, id: string): TerminalTab {
  return { ...tab, id, error: undefined, status: "connecting" };
}
