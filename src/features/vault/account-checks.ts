// The instant checks of the account forms. The server stays authoritative; these only catch what
// is wrong before a request (same rules as account/api.rs and sync/src/shapes.ts).

export type AccountMode = "signIn" | "register" | "recover";
export type AccountDraft = {
  server: string;
  username: string;
  password: string;
  confirm: string;
  invite: string;
  recoveryKey: string;
};
export const emptyAccountDraft: AccountDraft = {
  server: "",
  username: "",
  password: "",
  confirm: "",
  invite: "",
  recoveryKey: "",
};
const MIN_ACCOUNT_PASSWORD = 12;

/** HTTPS, or HTTP on this machine only; no credentials, query or fragment. */
export function serverAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return (
    (url.protocol === "https:" || (url.protocol === "http:" && local)) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
}

const usernameAllowed = (name: string) =>
  /^[a-z0-9][a-z0-9._-]{1,31}$/.test(name.trim());

// 32 bytes in base32 are 52 characters; dashes and spaces only group them.
const recoveryAllowed = (key: string) =>
  /^[A-HJ-NP-Z2-9]{52}$/i.test(key.replace(/[\s-]/g, ""));

/** Field → i18n key of what is wrong now. */
export function accountChecks(
  mode: AccountMode,
  draft: AccountDraft,
): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (!serverAllowed(draft.server))
    errors.server = "vault.accountForm.serverInvalid";
  if (!usernameAllowed(draft.username))
    errors.username = "vault.accountForm.usernameInvalid";
  if (mode === "signIn") {
    if (!draft.password) errors.password = "vault.accountForm.passwordMissing";
    return errors;
  }
  if (draft.password.length < MIN_ACCOUNT_PASSWORD)
    errors.password = "vault.accountForm.passwordShort";
  else if (draft.password !== draft.confirm)
    errors.confirm = "vault.useUnlock.thePasswordsDoNot";
  if (mode === "register" && !draft.invite.trim())
    errors.invite = "vault.accountForm.inviteMissing";
  if (mode === "recover" && !recoveryAllowed(draft.recoveryKey))
    errors.recoveryKey = "vault.accountForm.recoveryInvalid";
  return errors;
}

/** The checks of the password change: the current one, then a new one typed twice. */
export function passwordChecks(draft: {
  current: string;
  password: string;
  confirm: string;
}): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  if (!draft.current) errors.current = "vault.accountForm.passwordMissing";
  if (draft.password.length < MIN_ACCOUNT_PASSWORD)
    errors.password = "vault.accountForm.passwordShort";
  else if (draft.password !== draft.confirm)
    errors.confirm = "vault.useUnlock.thePasswordsDoNot";
  return errors;
}
