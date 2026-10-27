import type { View, Workspace } from "../types";
import { requireValue } from "./require";
import type { Args } from "./require";

export function saveWorkspace(next: View, args: Args): void {
  const w = args.workspace as Workspace;
  requireValue(w.name.trim() && w.name.length <= 80, "Nome non valido");
  const saved = { ...w, id: w.id || crypto.randomUUID() };
  next.workspaces = [
    ...next.workspaces.filter((x) => x.id !== saved.id),
    saved,
  ];
}

export function deleteWorkspace(next: View, args: Args): void {
  next.workspaces = next.workspaces.filter((w) => w.id !== args.id);
}
