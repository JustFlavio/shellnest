import type { Group, Host, HostDraft } from "@/lib/types";
import { inheritedIdentity } from "./groups.mjs";

// A stored host with no identity and no credentials of its own takes its folder's identity.
export const hostInheritsIdentity = (host: Host) =>
  !host.identityId && !host.username && !!host.identitySource;

export function hostDraftIsValid(
  draft: HostDraft,
  identities: { id: string }[],
  stored?: Host,
  groups: Group[] = [],
) {
  const credentials = draft.credentials ?? {
    username: draft.username ?? "",
    password: "",
  };
  return !!(
    draft.name.trim() &&
    draft.address.trim() &&
    draft.address.length <= 253 &&
    !/[\s\x00-\x1f\x7f/@\\[\]]/.test(draft.address) &&
    (draft.ownPort === null ||
      (Number.isInteger(draft.ownPort) &&
        draft.ownPort > 0 &&
        draft.ownPort <= 65535)) &&
    (draft.inheritIdentity
      ? !!inheritedIdentity(groups, draft.groupId)
      : draft.identityId
        ? identities.some((i) => i.id === draft.identityId)
        : credentials.username.trim() &&
          !/[\s\x00-\x1f\x7f]/.test(credentials.username.trim()) &&
          (credentials.password ||
            (stored?.id === draft.id &&
              !stored.identityId &&
              stored.hasPassword)))
  );
}

export function hostDraftIsDirty(draft: HostDraft, stored?: Host) {
  const credentials = draft.credentials ?? {
    username: draft.username ?? "",
    password: "",
  };
  return (
    !!credentials.password ||
    (!draft.identityId &&
      !draft.inheritIdentity &&
      credentials.username !== (stored?.username ?? "")) ||
    (stored
      ? (["name", "address", "ownPort", "groupId", "identityId"] as const).some(
          (key) => draft[key] !== stored[key],
        ) || !!draft.inheritIdentity !== hostInheritsIdentity(stored)
      : !!(
          draft.name ||
          draft.address ||
          draft.groupId ||
          draft.identityId ||
          draft.inheritIdentity ||
          draft.ownPort !== null
        ))
  );
}

export const hostIdentity = <I extends { id: string }>(
  identities: I[],
  host: Host,
) =>
  identities.find(
    (i) => i.id === (host.effectiveIdentityId || host.identityId),
  );
