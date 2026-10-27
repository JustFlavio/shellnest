import { inheritedIdentity } from "@/features/hosts/groups.ts";
import type { View, Host, HostCredentials } from "../types";
import { requireValue } from "./require";
import type { Args } from "./require";

export function revealHostPassword(next: View, args: Args): string {
  const host = next.hosts.find((h) => h.id === args.id);
  requireValue(
    host && !host.identityId && host.hasPassword,
    "Questo host non ha una password privata salvata",
  );
  // Preview never retains entered secrets; reveal only a labelled sample.
  return "password-dimostrativa";
}

export function saveHost(next: View, args: Args): void {
  const host = args.host as Host;
  requireValue(
    host?.id &&
      host.name?.trim() &&
      host.address?.trim() &&
      host.address.length <= 253 &&
      !/[\s\x00-\x1f\x7f/@\\[\]]/.test(host.address) &&
      (host.port === null ||
        (Number.isInteger(host.port) && host.port > 0 && host.port <= 65535)),
    "Nome, indirizzo e porta valida sono obbligatori",
  );
  requireValue(
    !host.groupId || next.groups.some((g) => g.id === host.groupId),
    "Cartella non trovata",
  );
  const inherit = args.inherit === true;
  const previous = next.hosts.find((h) => h.id === host.id);
  let username: string | null = null;
  let hasPassword = false;
  if (inherit) {
    requireValue(
      !host.identityId &&
        args.credentials == null &&
        inheritedIdentity(next.groups, host.groupId),
      "La cartella non fornisce un’identità",
    );
  } else if (!host.identityId) {
    const credentials = args.credentials as HostCredentials | undefined;
    requireValue(
      credentials == null ||
        (typeof credentials.username === "string" &&
          typeof credentials.password === "string"),
      "Credenziali non valide",
    );
    username = credentials?.username?.trim() ?? previous?.username ?? "";
    hasPassword =
      !!credentials?.password ||
      !!(!previous?.identityId && previous?.hasPassword);
    requireValue(
      username &&
        !/[\s\x00-\x1f\x7f]/.test(username) &&
        hasPassword &&
        (credentials == null || typeof credentials.password === "string"),
      "Inserisci utente SSH e password per questo host",
    );
  } else {
    requireValue(
      args.credentials == null,
      "Scegli credenziali dell’host oppure un’identità",
    );
    requireValue(
      next.identities.some((i) => i.id === host.identityId),
      "Seleziona un’identità valida",
    );
  }
  const old = next.hosts.find(
    (h) =>
      h.id === host.id && h.address === host.address && h.ownPort === host.port,
  );
  const saved: Host = {
    id: host.id,
    name: host.name,
    address: host.address,
    port: host.port ?? 22,
    ownPort: host.port,
    groupId: host.groupId,
    identityId: host.identityId,
    effectiveIdentityId: host.identityId,
    identitySource: "",
    username,
    hasPassword,
    fingerprint: old?.fingerprint ?? "",
    os: old?.os,
    lastConnectedAt: old?.lastConnectedAt,
  };
  next.hosts = [...next.hosts.filter((h) => h.id !== host.id), saved];
}

export function deleteHost(next: View, args: Args): void {
  next.hosts = next.hosts.filter((h) => h.id !== args.id);
  next.workspaces = next.workspaces.filter(
    (w) => !JSON.stringify(w.layout).includes(String(args.id)),
  );
}

export function assignIdentity(next: View, args: Args): void {
  const ids = args.ids as string[];
  const known = new Set(next.hosts.map((h) => h.id));
  requireValue(
    Array.isArray(ids) &&
      ids.length &&
      ids.every((id) => known.has(id)) &&
      next.identities.some((i) => i.id === args.identityId),
    "Seleziona host e identità validi",
  );
  const assigned = new Set(ids);
  next.hosts = next.hosts.map((h) =>
    assigned.has(h.id)
      ? {
          ...h,
          identityId: String(args.identityId),
          username: null,
          hasPassword: false,
        }
      : h,
  );
}

// The preview has no network: every unverified host shows the same sample key.
export const PREVIEW_FINGERPRINT = "SHA256:impronta-dimostrativa";

export function probeHost(next: View, args: Args): string {
  requireValue(
    next.hosts.some((h) => h.id === args.id),
    "Host non trovato",
  );
  return PREVIEW_FINGERPRINT;
}

export function trustHost(next: View, args: Args): void {
  const host = next.hosts.find((h) => h.id === args.id);
  requireValue(host, "Host non trovato");
  requireValue(args.expected === PREVIEW_FINGERPRINT, "Impronta non valida");
  host!.fingerprint = PREVIEW_FINGERPRINT;
}
