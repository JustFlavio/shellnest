import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deleteBlock,
  leavesVault,
  lockLead,
  lockTitle,
  unlockLabel,
} from "./vault-copy.ts";
import { i18n } from "../../i18n/i18n.ts";

// These assertions read the Italian copy.
await i18n.changeLanguage("it");

test("the lock screen copy depends on the vault, the account form and the platform", () => {
  const state = { exists: false, account: null, interactive: true };
  assert.equal(lockTitle(state), "Crea vault locale");
  assert.equal(lockTitle({ ...state, account: "signIn" }), "Accedi al server");
  assert.equal(lockTitle({ ...state, account: "register" }), "Crea account");
  assert.equal(lockTitle({ ...state, account: "recover" }), "Recupera account");
  assert.equal(lockTitle({ ...state, exists: true }), "Sblocca vault");
  assert.equal(
    lockTitle({ ...state, interactive: false }),
    "Esplora Shellnest",
  );
  assert.match(lockLead({ ...state, interactive: false }), /open source/);
  assert.equal(lockLead({ ...state, exists: true }), "");
  assert.match(lockLead({ ...state, account: "register" }), /invito/);
});

test("the unlock button reflects busy and existing", () => {
  assert.equal(unlockLabel({ busy: true, exists: true }), "Attendi…");
  assert.equal(unlockLabel({ busy: false, exists: true }), "Sblocca");
  assert.equal(unlockLabel({ busy: false, exists: false }), "Crea vault");
});

test("only an empty vault other than the default one can be deleted; members leave", () => {
  const key = {
    id: "k",
    name: "k",
    fingerprint: "",
    identityCount: 0,
    hostCount: 0,
  };
  const empty = {
    hosts: [],
    identities: [],
    keys: [],
    groups: [],
    workspaces: [],
    remote: null,
  };
  assert.equal(deleteBlock({ ...empty, vaultId: "work" }), "");
  assert.match(deleteBlock({ ...empty, vaultId: "personal" }), /predefinito/);
  assert.match(
    deleteBlock({ ...empty, vaultId: "work", keys: [key] }),
    /Svuota/,
  );
  const shared = { role: "editor" as const, members: 3 };
  assert.ok(leavesVault({ remote: shared }));
  assert.equal(
    deleteBlock({ ...empty, vaultId: "w", keys: [key], remote: shared }),
    "",
  );
  const alone = { role: "owner" as const, members: 1 };
  assert.equal(leavesVault({ remote: alone }), false);
  assert.match(
    deleteBlock({ ...empty, vaultId: "personal", keys: [key], remote: alone }),
    /Svuota/,
  );
  assert.equal(
    deleteBlock({ ...empty, vaultId: "personal", remote: alone }),
    "",
  );
});
