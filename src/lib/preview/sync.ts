import type { AccountInfo, Device, Member, Role, View } from "../types";
import { requireValue } from "./require";
import type { Args } from "./require";

// A pretend sync server: one account, no network, no encryption. Passwords are only length-checked.
export function createPreviewAccount() {
  let account: AccountInfo | null = null;
  const members = new Map<string, Member[]>();
  const devices: Device[] = [
    { id: "this", name: "Preview", createdAt: 0, lastSeenAt: 0, current: true },
  ];
  const me = (): Member => ({
    userId: "preview-user",
    username: account?.username ?? "",
    role: "owner",
    safetyCode: account?.safetyCode ?? "",
    me: true,
  });
  const signIn = (args: Args, minimum: number) => {
    requireValue(
      typeof args.server === "string" && /^https:\/\//.test(args.server),
      "sync.InsecureUrl",
    );
    requireValue(
      typeof args.username === "string" &&
        /^[a-z0-9][a-z0-9._-]{1,31}$/.test(args.username),
      "sync.WrongLogin",
    );
    requireValue(
      typeof args.password === "string" && args.password.length >= minimum,
      minimum > 1 ? "sync.PasswordTooShort" : "sync.WrongLogin",
    );
    account = {
      server: String(args.server),
      username: String(args.username),
      admin: true,
      unlocked: true,
      safetyCode: "1A2B 3C4D 5E6F 7A8B",
    };
  };
  const listFor = (vaultId: string) => {
    const list = members.get(vaultId) ?? [me()];
    members.set(vaultId, list);
    return list;
  };
  const roleOf = (args: Args): Role => {
    requireValue(
      ["owner", "editor", "viewer"].includes(String(args.role)),
      "sync.NotAllowed",
    );
    return args.role as Role;
  };
  return {
    get: () => account,
    signIn: (args: Args) => signIn(args, 1),
    register: (args: Args) => {
      requireValue(
        typeof args.invite === "string" && !!args.invite.trim(),
        "sync.InviteInvalid",
      );
      signIn(args, 12);
      return "PREVIEW-RECOVERY-KEY-NOT-REAL";
    },
    signOut: () => {
      account = null;
    },
    devices: () => structuredClone(devices),
    members: (vaultId: string) => structuredClone(listFor(vaultId)),
    addMember: (next: View, args: Args) => {
      requireValue(next.remote?.role === "owner", "sync.NotAllowed");
      const username = String(args.username ?? "");
      requireValue(
        /^[a-z0-9][a-z0-9._-]{1,31}$/.test(username),
        "sync.UserNotFound",
      );
      const list = listFor(next.vaultId);
      const existing = list.find((m) => m.username === username);
      if (existing) existing.role = roleOf(args);
      else
        list.push({
          userId: `preview-${username}`,
          username,
          role: roleOf(args),
          safetyCode: "9C8D 7E6F 5A4B 3C2D",
          me: false,
        });
      next.remote = { ...next.remote!, members: list.length };
      return structuredClone(list);
    },
    setRole: (next: View, args: Args) => {
      requireValue(next.remote?.role === "owner", "sync.NotAllowed");
      const member = listFor(next.vaultId).find(
        (m) => m.userId === args.userId,
      );
      requireValue(member && !member.me, "sync.NotFound");
      member!.role = roleOf(args);
      return structuredClone(listFor(next.vaultId));
    },
    removeMember: (next: View, args: Args) => {
      requireValue(next.remote?.role === "owner", "sync.NotAllowed");
      const list = listFor(next.vaultId).filter(
        (m) => m.me || m.userId !== args.userId,
      );
      members.set(next.vaultId, list);
      next.remote = { ...next.remote!, members: list.length };
      return {
        members: structuredClone(list),
        exposed: next.identities.filter((i) => i.shared).map((i) => i.name),
      };
    },
  };
}

export function shareIdentity(next: View, args: Args): void {
  requireValue(next.remote && next.remote.role !== "viewer", "model.ReadOnly");
  const identity = next.identities.find((i) => i.id === args.id);
  requireValue(identity, "model.IdentityNotFound");
  identity!.shared = true;
  const key = next.keys.find((k) => k.id === identity!.keyId);
  if (key) key.shared = true;
}
