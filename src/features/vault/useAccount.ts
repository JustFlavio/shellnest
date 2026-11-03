import { useState } from "react";
import type { Device, Member, Role, View } from "@/lib/types";
import type { VaultApi } from "./useVault";
import { emptyAccountDraft } from "./account-checks.ts";
import type { AccountDraft, AccountMode } from "./account-checks.ts";

type Removal = { members: Member[]; exposed: string[] };

/** The sync account: signing in or up, the account's devices and invites, the open vault's members. */
export function useAccount(
  { view, run, update, invokeCommand, invokeScoped, setError, epoch }: VaultApi,
  // Signing in or out can open or close a vault: everything tied to the old one is reset.
  replace: (next: View) => void,
) {
  const [form, setForm] = useState<{
      mode: AccountMode;
      draft: AccountDraft;
    } | null>(null),
    [recoveryKey, setRecoveryKey] = useState(""),
    [members, setMembers] = useState<Member[] | null>(null),
    [membersFor, setMembersFor] = useState(""),
    [exposed, setExposed] = useState<string[] | null>(null),
    [devices, setDevices] = useState<Device[] | null>(null),
    [invite, setInvite] = useState(""),
    [passwordOpen, setPasswordOpen] = useState(false);
  // The members shown belong to one vault: another vault starts empty.
  if (membersFor !== view.vaultId) {
    setMembersFor(view.vaultId);
    setMembers(null);
  }
  const openForm = (mode: AccountMode = "signIn") => {
    setError("");
    setForm({
      mode,
      draft: {
        ...emptyAccountDraft,
        server: view.account?.server ?? "",
        username: view.account?.username ?? "",
      },
    });
  };
  const submitForm = () => {
    if (!form) return;
    const { mode, draft } = form;
    void run(async () => {
      const common = {
        server: draft.server.trim(),
        username: draft.username.trim(),
        password: draft.password,
      };
      let next: View;
      if (mode === "register") {
        const registered = await invokeCommand<{
          view: View;
          recoveryKey: string;
        }>("register", {
          ...common,
          invite: draft.invite.trim(),
        });
        next = registered.view;
        setRecoveryKey(registered.recoveryKey);
      } else if (mode === "recover")
        next = await invokeCommand<View>("recover_account", {
          ...common,
          recoveryKey: draft.recoveryKey,
        });
      else next = await invokeCommand<View>("sign_in", common);
      epoch.current++;
      replace(next);
      setForm(null);
    });
  };
  const signOut = () =>
    void run(async () => {
      epoch.current++;
      replace(await invokeCommand<View>("sign_out"));
      setDevices(null);
    });
  const upload = () =>
    void run(async () => update(await invokeScoped<View>("upload_vault")));
  const loadMembers = () =>
    void run(async () =>
      setMembers(await invokeScoped<Member[]>("vault_members")),
    );
  const addMember = (username: string, role: Role, done: () => void) =>
    void run(async () => {
      setMembers(
        await invokeScoped<Member[]>("add_member", {
          username: username.trim(),
          role,
        }),
      );
      done();
    });
  const setRole = (userId: string, role: Role) =>
    void run(async () =>
      setMembers(
        await invokeScoped<Member[]>("set_member_role", { userId, role }),
      ),
    );
  const removeMember = (userId: string) =>
    void run(async () => {
      const removal = await invokeScoped<Removal>("remove_member", { userId });
      setMembers(removal.members);
      setExposed(removal.exposed);
    });
  const shareIdentity = (id: string) =>
    void run(async () =>
      update(await invokeScoped<View>("share_identity", { id })),
    );
  const loadDevices = () =>
    void run(async () => setDevices(await invokeCommand<Device[]>("devices")));
  const revokeDevice = (id: string) =>
    void run(async () =>
      setDevices(await invokeCommand<Device[]>("revoke_device", { id })),
    );
  const createInvite = (admin: boolean) =>
    void run(async () =>
      setInvite(await invokeCommand<string>("create_invite", { admin })),
    );
  const changePassword = (current: string, password: string) =>
    void run(async () => {
      await invokeCommand("change_password", { current, password });
      setPasswordOpen(false);
    });
  return {
    form,
    openForm,
    setForm,
    submitForm,
    closeForm: () => {
      setError("");
      setForm(null);
    },
    recoveryKey,
    clearRecoveryKey: () => setRecoveryKey(""),
    signOut,
    upload,
    members,
    loadMembers,
    addMember,
    setRole,
    removeMember,
    exposed,
    clearExposed: () => setExposed(null),
    shareIdentity,
    devices,
    loadDevices,
    revokeDevice,
    closeDevices: () => setDevices(null),
    invite,
    createInvite,
    clearInvite: () => setInvite(""),
    passwordOpen,
    setPasswordOpen: (open: boolean) => {
      setError("");
      setPasswordOpen(open);
    },
    changePassword,
  };
}
