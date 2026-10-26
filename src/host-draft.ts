import type { Host, HostDraft } from "./types";

export function hostDraftIsValid(
  draft: HostDraft,
  identities: { id: string }[],
  stored?: Host,
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
    Number.isInteger(draft.port) &&
    draft.port > 0 &&
    draft.port <= 65535 &&
    (draft.identityId
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
    (!draft.identityId && credentials.username !== (stored?.username ?? "")) ||
    (stored
      ? (["name", "address", "port", "group", "identityId"] as const).some(
          (key) => draft[key] !== stored[key],
        )
      : !!(
          draft.name ||
          draft.address ||
          draft.group ||
          draft.identityId ||
          draft.port !== 22
        ))
  );
}
