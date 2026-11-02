// Instant checks of the identity, key and folder editors: field → i18n key, the backend's rules and messages.
// What only the backend can know (a duplicate, an unreadable key) comes back from it with the same field.
import type { GroupForm, IdentityForm, KeyForm } from "../../lib/types.ts";

type Checks = Partial<Record<string, string>>;

export function identityFormErrors(
  form: IdentityForm,
  hasSavedPassword: boolean,
): Checks {
  const errors: Checks = {};
  if (!form.name.trim()) errors.name = "error.model.IdentityIncomplete";
  if (!form.username.trim()) errors.username = "error.model.UsernameMissing";
  if (form.auth === "key" && !form.keyId)
    errors.key = "hosts.hostEditor.chooseAKey";
  if (form.auth === "password" && !form.password && !hasSavedPassword)
    errors.password = "error.model.PasswordRequired";
  return errors;
}

export function keyFormErrors(form: KeyForm, existing: boolean): Checks {
  const errors: Checks = {};
  if (!form.name.trim()) errors.name = "error.model.KeyNameMissing";
  if (!existing && !form.privateKey.trim())
    errors.privateKey = "error.model.KeyImportRequired";
  return errors;
}

export function groupFormErrors(form: GroupForm): Checks {
  const errors: Checks = {};
  const name = form.name.trim();
  if (!name || name.length > 80 || /[/\x00-\x1f\x7f]/.test(name))
    errors.name = "error.model.GroupNameInvalid";
  if (
    form.port !== null &&
    !(Number.isInteger(form.port) && form.port > 0 && form.port <= 65535)
  )
    errors.port = "error.model.PortInvalid";
  return errors;
}
