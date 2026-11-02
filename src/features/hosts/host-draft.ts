import type { Group, Host, HostDraft } from "@/lib/types";
import { inheritedIdentity } from "./groups.ts";

// A stored host with no identity and no credentials of its own takes its folder's identity.
export const hostInheritsIdentity = (host: Host) =>
  !host.identityId && !host.username && !!host.identitySource;

export type HostField =
  | "name"
  | "address"
  | "port"
  | "tags"
  | "identity"
  | "username"
  | "password"
  | "key";

/** Per field, the i18n key of what blocks saving; the same rules the backend applies, with its messages. */
export function hostDraftErrors(
  draft: HostDraft,
  identities: { id: string }[],
  stored?: Host,
  groups: Group[] = [],
): Partial<Record<HostField, string>> {
  const errors: Partial<Record<HostField, string>> = {};
  const credentials = draft.credentials ?? {
    username: draft.username ?? "",
    password: "",
    keyId: draft.keyId,
  };
  const tags = draft.tags ?? [];
  if (!draft.name.trim()) errors.name = "error.model.HostFieldsRequired";
  if (
    !draft.address.trim() ||
    draft.address.length > 253 ||
    /[\s\x00-\x1f\x7f/@\\[\]]/.test(draft.address)
  )
    errors.address = "error.model.EndpointInvalid";
  if (
    draft.ownPort !== null &&
    !(
      Number.isInteger(draft.ownPort) &&
      draft.ownPort > 0 &&
      draft.ownPort <= 65535
    )
  )
    errors.port = "error.model.PortInvalid";
  if (
    tags.length > 32 ||
    tags.some(
      (tag) =>
        !tag.trim() || [...tag].length > 64 || /[\x00-\x1f\x7f]/.test(tag),
    )
  )
    errors.tags = "error.model.HostTagsInvalid";
  if (draft.inheritIdentity) {
    if (!inheritedIdentity(groups, draft.groupId))
      errors.identity = "error.model.CredentialsRequired";
  } else if (draft.identityId) {
    if (!identities.some((i) => i.id === draft.identityId))
      errors.identity = "error.model.IdentityNotFound";
  } else {
    const username = credentials.username.trim();
    if (!username) errors.username = "error.model.UsernameMissing";
    else if (/[\s\x00-\x1f\x7f]/.test(username))
      errors.username = "error.model.UsernameInvalid";
    if (credentials.keyId !== undefined) {
      if (!credentials.keyId) errors.key = "hosts.hostEditor.chooseAKey";
    } else if (
      !credentials.password &&
      !(stored?.id === draft.id && !stored.identityId && stored.hasPassword)
    )
      errors.password = "error.model.PasswordRequired";
  }
  return errors;
}

export const hostDraftIsValid = (...args: Parameters<typeof hostDraftErrors>) =>
  Object.keys(hostDraftErrors(...args)).length === 0;

// `initial` is the draft a new host opened with: the folder and inherited identity the page preset are not an edit.
export function hostDraftIsDirty(
  draft: HostDraft,
  stored?: Host,
  initial?: HostDraft,
) {
  const credentials = draft.credentials ?? {
    username: draft.username ?? "",
    password: "",
    keyId: draft.keyId,
  };
  return (
    !!credentials.password ||
    (!draft.identityId &&
      !draft.inheritIdentity &&
      (credentials.keyId ?? "") !== (stored?.keyId ?? "")) ||
    JSON.stringify(draft.tags ?? []) !== JSON.stringify(stored?.tags ?? []) ||
    (!draft.identityId &&
      !draft.inheritIdentity &&
      credentials.username !== (stored?.username ?? "")) ||
    (stored
      ? (["name", "address", "ownPort", "groupId", "identityId"] as const).some(
          (key) => draft[key] !== stored[key],
        ) || !!draft.inheritIdentity !== hostInheritsIdentity(stored)
      : !!(draft.name || draft.address || draft.identityId) ||
        draft.ownPort !== null ||
        draft.groupId !== (initial?.groupId ?? "") ||
        !!draft.inheritIdentity !== !!initial?.inheritIdentity)
  );
}

export const hostIdentity = <I extends { id: string }>(
  identities: I[],
  host: Host,
) =>
  identities.find(
    (i) => i.id === (host.effectiveIdentityId || host.identityId),
  );
