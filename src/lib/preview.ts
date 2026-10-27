import { emptyView } from "./types";
import { resolveHost } from "@/features/hosts/groups.mjs";
import type { View } from "./types";
import {
  assignIdentity,
  deleteHost,
  revealHostPassword,
  saveHost,
} from "./preview/hosts";
import {
  deleteIdentity,
  deleteKey,
  saveIdentity,
  saveKey,
} from "./preview/identities";
import { deleteGroup, saveGroup } from "./preview/groups";
import { deleteWorkspace, saveWorkspace } from "./preview/workspaces";
import { configureSync } from "./preview/sync";
import { previewView } from "./preview/sample-view";
import { requireValue } from "./preview/require";
import type { Args } from "./preview/require";

// Commands that edit the active vault in place.
const editors: Record<string, (next: View, args: Args) => void> = {
  save_host: saveHost,
  delete_host: deleteHost,
  assign_identity: assignIdentity,
  save_identity: saveIdentity,
  delete_identity: deleteIdentity,
  save_key: saveKey,
  delete_key: deleteKey,
  save_group: saveGroup,
  delete_group: deleteGroup,
  save_workspace: saveWorkspace,
  delete_workspace: deleteWorkspace,
  configure_sync: configureSync,
};

// Only UI metadata lives here: passwords, private keys and tokens are discarded.
export function createPreviewBackend() {
  const vaults = new Map<string, View>([["personal", previewView()]]);
  let selected = "personal";
  return async <T>(
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    if (command === "select_vault") {
      if (!vaults.has(String(args.vaultId)))
        throw new Error("Vault non disponibile");
      selected = String(args.vaultId);
    }
    const current = vaults.get(selected)!;
    if (args.vaultId && args.vaultId !== selected)
      throw new Error("Vault non attivo");
    const next = structuredClone(current);
    if (
      ![
        "status",
        "select_vault",
        "unlock",
        "create_vault",
        "rename_vault",
        "delete_vault",
      ].includes(command)
    )
      requireValue(next.unlocked, "Sblocca prima il vault");
    switch (command) {
      case "status":
      case "select_vault":
        break;
      case "unlock":
        requireValue(
          typeof args.password === "string" &&
            args.password.length >= (next.exists ? 1 : 12),
          "Inserisci una password fittizia valida",
        );
        next.exists = true;
        next.unlocked = true;
        break;
      case "lock":
        next.unlocked = false;
        break;
      case "create_vault": {
        requireValue(
          typeof args.name === "string" &&
            args.name.trim() &&
            args.name.length <= 80,
          "Assegna un nome al vault (massimo 80 caratteri)",
        );
        const id = crypto.randomUUID();
        vaults.set(id, {
          ...structuredClone(emptyView),
          vaultId: id,
          vaultName: String(args.name).trim(),
        });
        selected = id;
        return snapshot() as T;
      }
      case "delete_vault":
        requireValue(
          selected !== "personal",
          "Il vault Personale non può essere eliminato",
        );
        requireValue(
          !current.hosts.length &&
            !current.identities.length &&
            !current.keys.length &&
            !current.groups.length &&
            !current.workspaces.length,
          "Il vault non è vuoto: eliminane prima il contenuto",
        );
        vaults.delete(selected);
        selected = "personal";
        return snapshot() as T;
      case "rename_vault":
        requireValue(
          typeof args.name === "string" &&
            args.name.trim() &&
            args.name.length <= 80,
          "Assegna un nome al vault (massimo 80 caratteri)",
        );
        next.vaultName = String(args.name).trim();
        break;
      case "reveal_host_password":
        return revealHostPassword(next, args) as T;
      default: {
        const edit = editors[command];
        if (!edit)
          throw new Error(
            "Questa funzione richiede l’app desktop. L’anteprima non apre connessioni di rete.",
          );
        edit(next, args);
      }
    }
    vaults.set(selected, next);
    return snapshot() as T;

    function snapshot(): View {
      const view = structuredClone(vaults.get(selected)!);
      view.vaults = [...vaults.values()].map((v) => ({
        id: v.vaultId,
        name: v.vaultName,
        exists: v.exists,
      }));
      view.hosts.forEach((h) => Object.assign(h, resolveHost(view.groups, h)));
      view.identities.forEach((i) => {
        i.hostCount = view.hosts.filter((h) => h.identityId === i.id).length;
      });
      view.keys.forEach((k) => {
        const ids = view.identities
          .filter((i) => i.keyId === k.id)
          .map((i) => i.id);
        k.identityCount = ids.length;
        k.hostCount = view.hosts.filter((h) =>
          ids.includes(h.identityId),
        ).length;
      });
      if (!view.unlocked) {
        view.hosts = [];
        view.identities = [];
        view.keys = [];
        view.groups = [];
        view.workspaces = [];
      }
      return view;
    }
  };
}
