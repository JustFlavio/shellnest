import type { Host, Identity, QuickTarget, TerminalTab } from "@/lib/types";

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

export function quickTab(
  target: QuickTarget,
  identity: Identity,
  vaultId: string,
): TerminalTab {
  return {
    id: crypto.randomUUID(),
    kind: "quick",
    vaultId,
    title: target.address,
    username: target.username ?? identity.username,
    identityName: identity.name,
    target,
    status: "connecting",
  };
}

/** The same session started over, under a new id. */
export function restarted(tab: TerminalTab, id: string): TerminalTab {
  return { ...tab, id, error: undefined, status: "connecting" };
}
