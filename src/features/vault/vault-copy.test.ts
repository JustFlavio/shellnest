import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deleteBlock,
  lockLead,
  lockTitle,
  syncLabel,
  syncTitle,
  unlockLabel,
} from "./vault-copy.ts";

const synced = { syncConfigured: true, dirty: false, lastSync: "10:30" };

test("the sync label follows the state, sync errors first", () => {
  assert.equal(
    syncLabel({ ...synced, syncState: "syncing" }),
    "Sincronizzazione…",
  );
  assert.equal(
    syncLabel({ ...synced, syncState: "error" }),
    "Sync non riuscita · Riprova",
  );
  assert.equal(syncLabel({ ...synced, syncState: "idle" }), "Sync 10:30");
  assert.equal(
    syncLabel({ ...synced, syncState: "idle", dirty: true }),
    "Da sincronizzare",
  );
  assert.equal(
    syncLabel({ ...synced, syncState: "idle", lastSync: "" }),
    "Sync configurata",
  );
  assert.equal(
    syncLabel({ syncState: "idle", syncConfigured: false, lastSync: "" }),
    null,
  );
});

test("the sync title offers setup until sync is configured", () => {
  assert.match(syncTitle({ syncConfigured: false, lastSync: "" }), /Configura/);
  assert.equal(
    syncTitle({ syncConfigured: true, lastSync: "" }),
    "Sincronizza ora",
  );
  assert.match(syncTitle({ syncConfigured: true, lastSync: "10:30" }), /10:30/);
});

test("the lock screen copy depends on the vault and the platform", () => {
  const state = { exists: false, restore: false, interactive: true };
  assert.equal(lockTitle(state), "Crea vault locale");
  assert.equal(lockTitle({ ...state, restore: true }), "Collega dispositivo");
  assert.equal(lockTitle({ ...state, exists: true }), "Sblocca vault");
  assert.equal(
    lockTitle({ ...state, interactive: false }),
    "Esplora Shellnest",
  );
  assert.match(lockLead({ ...state, interactive: false }), /open source/);
  assert.equal(
    lockLead({ ...state, exists: true }),
    "Inserisci la password principale.",
  );
});

test("the unlock button reflects busy, existing and linking", () => {
  assert.equal(
    unlockLabel({ busy: true, exists: true, restore: false }),
    "Attendi…",
  );
  assert.equal(
    unlockLabel({ busy: false, exists: true, restore: false }),
    "Sblocca",
  );
  assert.equal(
    unlockLabel({ busy: false, exists: false, restore: true }),
    "Collega dispositivo",
  );
  assert.equal(
    unlockLabel({ busy: false, exists: false, restore: false }),
    "Crea vault",
  );
});

test("only an empty vault other than Personale can be deleted", () => {
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
  };
  assert.equal(deleteBlock({ ...empty, vaultId: "work" }), "");
  assert.match(deleteBlock({ ...empty, vaultId: "personal" }), /Personale/);
  assert.match(
    deleteBlock({ ...empty, vaultId: "work", keys: [key] }),
    /Svuota/,
  );
});
