export type Args = Record<string, unknown>;

// The form field of a model error, as `ModelError::field` names it on the Rust side.
const fields: Record<string, string> = {
  HostFieldsRequired: "name",
  IdentityIncomplete: "name",
  KeyNameMissing: "name",
  GroupNameInvalid: "name",
  GroupNameTaken: "name",
  EndpointInvalid: "address",
  PortInvalid: "port",
  HostTagsInvalid: "tags",
  UsernameInvalid: "username",
  UsernameMissing: "username",
  PasswordRequired: "password",
  IdentityKeyInvalid: "key",
  HostCredentialsInvalid: "key",
  KeyImportRequired: "privateKey",
  KeyUnreadable: "privateKey",
  KeyDuplicate: "privateKey",
  CredentialsRequired: "identity",
  CredentialsAndIdentity: "identity",
  InheritConflict: "identity",
  HostWithoutIdentity: "identity",
  HostIdentityMissing: "identity",
  GroupSettingsInvalid: "identity",
  HostPlacementInvalid: "group",
  GroupParentMissing: "group",
  GroupTooDeep: "group",
  GroupInsideItself: "group",
};

// The form field of a sync error, as `SyncError::field` names it.
const syncFields: Record<string, string> = {
  UrlInvalid: "server",
  InsecureUrl: "server",
  UrlParts: "server",
  UsernameTaken: "username",
  UserNotFound: "username",
  WrongLogin: "password",
  WrongPassword: "password",
  PasswordTooShort: "password",
  InviteInvalid: "invite",
  RecoveryInvalid: "recoveryKey",
};

/** Refuses like the Rust side does: with the `{ code, params, field }` the UI translates. */
export function requireValue(
  condition: unknown,
  code: string,
  params?: unknown,
): void {
  if (!condition) {
    const [area, name] = code.split(".");
    const field =
      area === "model"
        ? fields[name]
        : area === "sync"
          ? syncFields[name]
          : undefined;
    throw field ? { code, params, field } : { code, params };
  }
}
