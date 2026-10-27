import {
  depthOf,
  MAX_GROUP_DEPTH,
  subtreeIds,
} from "@/features/hosts/groups.mjs";
import type { View, Group } from "../types";
import { requireValue } from "./require";
import type { Args } from "./require";

export function saveGroup(next: View, args: Args): void {
  const g = args.group as Group;
  const name = String(g?.name ?? "").trim();
  requireValue(
    g?.id && name && name.length <= 80 && !/[/\x00-\x1f\x7f]/.test(name),
    "Nome cartella non valido",
  );
  requireValue(
    !g.parentId || next.groups.some((p) => p.id === g.parentId),
    "Gruppo padre non trovato",
  );
  requireValue(
    !g.parentId || !subtreeIds(next.groups, g.id).includes(g.parentId),
    "Una cartella non può stare dentro se stessa",
  );
  requireValue(
    !g.parentId || depthOf(next.groups, g.parentId) < MAX_GROUP_DEPTH,
    `Le cartelle possono avere al massimo ${MAX_GROUP_DEPTH} livelli`,
  );
  requireValue(
    !next.groups.some(
      (o) =>
        o.id !== g.id &&
        o.parentId === g.parentId &&
        o.name.toLowerCase() === name.toLowerCase(),
    ),
    `Esiste già una cartella chiamata ${name}`,
  );
  requireValue(
    !g.identityId || next.identities.some((i) => i.id === g.identityId),
    "Identità non valida",
  );
  requireValue(
    g.port === null ||
      (Number.isInteger(g.port) && g.port > 0 && g.port <= 65535),
    "Porta non valida",
  );
  next.groups = [...next.groups.filter((o) => o.id !== g.id), { ...g, name }];
}

export function deleteGroup(next: View, args: Args): void {
  requireValue(
    !next.groups.some((g) => g.parentId === args.id) &&
      !next.hosts.some((h) => h.groupId === args.id),
    "La cartella non è vuota: sposta o elimina prima il suo contenuto.",
  );
  next.groups = next.groups.filter((g) => g.id !== args.id);
}
