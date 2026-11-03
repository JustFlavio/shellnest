import { createPreviewSftp } from "./preview/sftp";
import { emptyView } from "./types";
import { resolveHost } from "@/features/hosts/groups.ts";
import type { View } from "./types";
import {
  assignIdentity,
  deleteHost,
  probeHost,
  revealHostPassword,
  saveHost,
  trustHost,
} from "./preview/hosts";
import {
  deleteIdentity,
  deleteKey,
  saveIdentity,
  saveKey,
} from "./preview/identities";
import { deleteGroup, saveGroup } from "./preview/groups";
import { deleteWorkspace, saveWorkspace } from "./preview/workspaces";
import { createPreviewAccount, shareIdentity } from "./preview/sync";
import { emptyPreviewView, previewView } from "./preview/sample-view";
import { requireValue } from "./preview/require";
import type { Args } from "./preview/require";

// Commands that edit the active vault in place.
const editors: Record<string, (next: View, args: Args) => void> = {
  save_host: saveHost,
  trust_host: trustHost,
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
  share_identity: shareIdentity,
};
// Account commands that work with every vault locked.
const accountCommands = ["sign_in", "register", "recover_account", "sign_out"];

// Only UI metadata lives here: passwords, private keys and tokens are discarded.
export function createPreviewBackend(
  empty = false,
  failing: ReadonlySet<string> = new Set(),
) {
  const vaults = new Map<string, View>([
    ["personal", empty ? emptyPreviewView() : previewView()],
  ]);
  let selected = "personal";
  const sftp = createPreviewSftp();
  const account = createPreviewAccount();
  return async <T>(
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    if (command === "select_vault") {
      if (!vaults.has(String(args.vaultId)))
        throw { code: "app.VaultNotFound" };
      sftp.closeAll();
      selected = String(args.vaultId);
    }
    if (failing.has(command))
      throw { code: "preview.Simulated", params: { command } };
    const current = vaults.get(selected)!;
    if (args.vaultId && args.vaultId !== selected)
      throw { code: "app.VaultSwitched" };
    const next = structuredClone(current);
    if (
      ![
        "status",
        "select_vault",
        "unlock",
        "create_vault",
        "rename_vault",
        "delete_vault",
        ...accountCommands,
      ].includes(command)
    )
      requireValue(next.unlocked, "app.VaultLocked");
    if (command.startsWith("sftp_")) return sftp.invoke(command, args) as T;
    switch (command) {
      case "status":
      case "select_vault":
        break;
      case "unlock":
        requireValue(
          typeof args.password === "string" &&
            args.password.length >= (next.exists ? 1 : 12),
          "vault.PasswordRequired",
        );
        next.exists = true;
        next.unlocked = true;
        break;
      case "lock":
        sftp.closeAll();
        next.unlocked = false;
        break;
      case "create_vault": {
        sftp.closeAll();
        requireValue(
          typeof args.name === "string" &&
            args.name.trim() &&
            args.name.length <= 80,
          "vault.NameInvalid",
        );
        const id = crypto.randomUUID();
        const remote = args.remote === true;
        requireValue(!remote || account.get(), "sync.NotSignedIn");
        vaults.set(id, {
          ...structuredClone(emptyView),
          vaultId: id,
          vaultName: String(args.name).trim(),
          // A server vault opens with the account, which is open.
          exists: remote,
          unlocked: remote,
          remote: remote ? { role: "owner", members: 1 } : null,
        });
        selected = id;
        return snapshot() as T;
      }
      case "delete_vault":
        sftp.closeAll();
        requireValue(
          selected !== "personal" || current.remote,
          "vault.DefaultNotDeletable",
        );
        requireValue(
          !current.hosts.length &&
            !current.identities.length &&
            !current.keys.length &&
            !current.groups.length &&
            !current.workspaces.length,
          "vault.NotEmpty",
        );
        vaults.delete(selected);
        selected = "personal";
        if (!vaults.has("personal"))
          vaults.set("personal", structuredClone(emptyView));
        return snapshot() as T;
      case "rename_vault":
        requireValue(
          typeof args.name === "string" &&
            args.name.trim() &&
            args.name.length <= 80,
          "vault.NameInvalid",
        );
        next.vaultName = String(args.name).trim();
        break;
      case "sign_in":
      case "recover_account":
        account.signIn(args);
        return snapshot() as T;
      case "register": {
        const recoveryKey = account.register(args);
        return { view: snapshot(), recoveryKey } as T;
      }
      case "sign_out":
        for (const [id, v] of vaults)
          if (v.remote) {
            vaults.delete(id);
            if (id === selected) selected = "personal";
          }
        if (!vaults.has("personal"))
          vaults.set("personal", structuredClone(emptyView));
        account.signOut();
        return snapshot() as T;
      case "upload_vault":
        requireValue(account.get(), "sync.NotSignedIn");
        requireValue(!next.remote, "sync.AlreadyOnServer");
        next.remote = { role: "owner", members: 1 };
        break;
      case "sync_vault":
        requireValue(next.remote, "sync.NotOnServer");
        break;
      case "leave_vault":
        requireValue(next.remote, "sync.NotOnServer");
        vaults.delete(selected);
        selected = "personal";
        if (!vaults.has("personal"))
          vaults.set("personal", structuredClone(emptyView));
        return snapshot() as T;
      case "vault_members":
        requireValue(next.remote, "sync.NotOnServer");
        return account.members(selected) as T;
      case "add_member": {
        const list = account.addMember(next, args);
        vaults.set(selected, next);
        return list as T;
      }
      case "set_member_role":
        return account.setRole(next, args) as T;
      case "remove_member": {
        const removal = account.removeMember(next, args);
        vaults.set(selected, next);
        return removal as T;
      }
      case "devices":
      case "revoke_device":
        requireValue(account.get(), "sync.NotSignedIn");
        return account.devices() as T;
      case "create_invite":
        requireValue(account.get(), "sync.NotSignedIn");
        return "preview-invite-code" as T;
      case "change_password":
        requireValue(
          typeof args.password === "string" && args.password.length >= 12,
          "sync.PasswordTooShort",
        );
        return undefined as T;
      case "probe_host":
        return probeHost(next, args) as T;
      case "probe_target":
        // No network in the preview: every address presents the same demo key.
        return "SHA256:impronta-dimostrativa" as T;
      case "reveal_host_password":
        return revealHostPassword(next, args) as T;
      default: {
        const edit = editors[command];
        if (!edit) throw { code: "preview.DesktopOnly" };
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
        remote: !!v.remote,
      }));
      view.account = account.get();
      view.hosts.forEach((h) => Object.assign(h, resolveHost(view.groups, h)));
      const hostsPerIdentity = new Map<string, number>();
      for (const h of view.hosts)
        hostsPerIdentity.set(
          h.identityId,
          (hostsPerIdentity.get(h.identityId) ?? 0) + 1,
        );
      view.identities.forEach((i) => {
        i.hostCount = hostsPerIdentity.get(i.id) ?? 0;
      });
      view.keys.forEach((k) => {
        const identities = view.identities.filter((i) => i.keyId === k.id);
        k.identityCount = identities.length;
        k.hostCount =
          identities.reduce((sum, i) => sum + i.hostCount, 0) +
          view.hosts.filter((h) => h.keyId === k.id).length;
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
