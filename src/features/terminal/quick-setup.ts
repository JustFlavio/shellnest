// The questions a quick connection asks in the timeline, as plain data and rules.
import type { HostDraft, Identity, QuickLogin } from "../../lib/types.ts";

export type QuickSetup = {
  username: string;
  // a saved identity with its own credentials; empty to log in inline
  identityId: string;
  method: "password" | "key";
  keyId: string;
  password: string;
  // for "Continua e salva"
  name: string;
};

export const emptySetup = (address: string, username = ""): QuickSetup => ({
  username,
  identityId: "",
  method: "password",
  keyId: "",
  password: "",
  name: address,
});

// The same rule as the address parser and the Rust side.
const validUser = (user: string) =>
  /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$/.test(user);

/** Identities that can log in on their own, matching the search text. */
export function pickableIdentities(identities: Identity[], query: string) {
  const text = query.trim().toLocaleLowerCase();
  return identities.filter(
    (i) =>
      (i.auth === "key" ? !!i.keyId : i.hasPassword) &&
      (!text ||
        i.name.toLocaleLowerCase().includes(text) ||
        i.username.toLocaleLowerCase().includes(text)),
  );
}

/** Whether the second question (password or key) is still needed. */
export const needsMethod = (setup: QuickSetup) => !setup.identityId;

export function quickLogin(setup: QuickSetup): QuickLogin | null {
  if (!validUser(setup.username)) return null;
  if (setup.identityId) return { kind: "identity", id: setup.identityId };
  if (setup.method === "key")
    return setup.keyId ? { kind: "key", id: setup.keyId } : null;
  return { kind: "password" };
}

/** A host can only be saved with a password it can reuse; the key and identity cases are always complete. */
export const canSave = (setup: QuickSetup) =>
  !!quickLogin(setup) &&
  !!setup.name.trim() &&
  (!!setup.identityId || setup.method === "key" || !!setup.password);

/** The host that "Continua e salva" stores: by identity, or with the typed credentials. */
export function hostToSave(
  setup: QuickSetup,
  target: { address: string; port: number },
  base: HostDraft,
  identityId: string,
): HostDraft {
  return {
    ...base,
    name: setup.name.trim(),
    address: target.address,
    ownPort: target.port === 22 ? null : target.port,
    identityId,
    credentials: identityId
      ? undefined
      : { username: setup.username, password: setup.password },
  };
}

/** The identity a key login is saved under: an existing one for that user and key, else a new name. */
export function identityForKey(
  identities: Identity[],
  username: string,
  keyId: string,
  keyName: string,
) {
  const found = identities.find(
    (i) => i.auth === "key" && i.keyId === keyId && i.username === username,
  );
  if (found) return { id: found.id, isNew: false, name: found.name };
  const names = new Set(identities.map((i) => i.name));
  const base = `${username} · ${keyName}`;
  let name = base;
  for (let n = 2; names.has(name); n++) name = `${base} (${n})`;
  return { id: crypto.randomUUID(), isNew: true, name };
}
