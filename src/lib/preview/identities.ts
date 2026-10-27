import type { View, IdentityForm, KeyForm } from "../types";
import { requireValue } from "./require";
import type { Args } from "./require";

export function saveIdentity(next: View, args: Args): void {
  const identity = args.identity as IdentityForm;
  requireValue(
    identity?.id && identity.name?.trim() && identity.username?.trim(),
    "Nome e utente SSH sono obbligatori",
  );
  requireValue(
    identity.auth === "key" || identity.auth === "password",
    "Metodo di autenticazione non valido",
  );
  const old = next.identities.find((i) => i.id === identity.id);
  const hasPassword =
    identity.auth === "password" && (!!identity.password || !!old?.hasPassword);
  requireValue(
    identity.auth === "password"
      ? hasPassword
      : next.keys.some((k) => k.id === identity.keyId),
    "Seleziona una chiave o inserisci una password fittizia",
  );
  next.identities = [
    ...next.identities.filter((i) => i.id !== identity.id),
    {
      id: identity.id,
      name: identity.name,
      username: identity.username,
      auth: identity.auth,
      keyId: identity.auth === "key" ? identity.keyId : "",
      hasPassword,
      hostCount: 0,
    },
  ];
}

export function saveKey(next: View, args: Args): void {
  const key = args.key as KeyForm;
  const old = next.keys.find((k) => k.id === key?.id);
  requireValue(
    key?.id && key.name?.trim() && (old || key.privateKey?.trim()),
    "Nome e chiave fittizia sono obbligatori",
  );
  next.keys = [
    ...next.keys.filter((k) => k.id !== key.id),
    {
      id: key.id,
      name: key.name,
      fingerprint: key.privateKey
        ? "Anteprima: chiave non verificata"
        : old!.fingerprint,
      identityCount: 0,
      hostCount: 0,
    },
  ];
}

export function deleteIdentity(next: View, args: Args): void {
  requireValue(
    !next.hosts.some((h) => h.identityId === args.id) &&
      !next.groups.some((g) => g.identityId === args.id),
    "Riassegna prima gli host che utilizzano questa identità",
  );
  next.identities = next.identities.filter((i) => i.id !== args.id);
}

export function deleteKey(next: View, args: Args): void {
  requireValue(
    !next.identities.some((i) => i.keyId === args.id),
    "Riassegna prima le identità che utilizzano questa chiave",
  );
  next.keys = next.keys.filter((k) => k.id !== args.id);
}
