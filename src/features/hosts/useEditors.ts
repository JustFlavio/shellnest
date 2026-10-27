import { useState } from "react";
import { inheritedIdentity } from "./groups.ts";
import { saveHostCommand } from "./save-host";
import { hostDraftIsValid, hostInheritsIdentity } from "./host-draft";
import { newGroup, newHost, newIdentity, newKey } from "@/lib/types";
import type {
  Group,
  GroupForm,
  Host,
  HostDraft,
  Identity,
  IdentityForm,
  KeyForm,
  SshKey,
  View,
} from "@/lib/types";
import { useHostAutosave } from "./useHostAutosave";
import type { Page } from "./useCollectionView";
import type { VaultApi } from "@/features/vault/useVault";

/** The editors for hosts, groups, identities and keys: open, close and save each, and the nesting between them. */
export function useEditors(
  vault: VaultApi,
  setActive: (id: string) => void,
  connect: (host: Host) => void,
  page: Page,
  group: string,
) {
  const { view, busy, epoch, update, run, invokeScoped, setError, setNotice } =
    vault;
  const [hostForm, setHostForm] = useState<HostDraft | null>(null),
    [groupForm, setGroupForm] = useState<GroupForm | null>(null),
    [identityForm, setIdentityForm] = useState<IdentityForm | null>(null),
    [keyForm, setKeyForm] = useState<KeyForm | null>(null);
  const hostAutosave = useHostAutosave(
    hostForm,
    view.hosts.find((h) => h.id === hostForm?.id),
    view.identities,
    view.groups,
    view.vaultId,
    busy || !!identityForm || !!keyForm || !!groupForm,
    async (draft) => {
      const generation = epoch.current;
      const next = await saveHostCommand(invokeScoped, draft);
      if (generation !== epoch.current)
        throw new Error("Il vault attivo è cambiato");
      update(next);
      return next.hosts.find((h) => h.id === draft.id)!;
    },
  );
  const hostFormIsValid = (form: HostDraft) =>
    hostDraftIsValid(
      form,
      view.identities,
      view.hosts.find((h) => h.id === form.id),
      view.groups,
    );
  // Background sync waits while an editor holds input that cannot be saved yet.
  const editorBlocksSync = (panelOpen: boolean) =>
    panelOpen && (!hostForm || !hostFormIsValid(hostForm));
  const draftFor = (groupId = ""): HostDraft => ({
    ...newHost(groupId),
    inheritIdentity: !!inheritedIdentity(view.groups, groupId),
  });
  const editDraft = (host: Host): HostDraft => ({
    ...host,
    inheritIdentity: hostInheritsIdentity(host),
  });
  const newHostIn = (groupId: string) => {
    setActive("vault");
    setHostForm(draftFor(groupId));
  };
  // From a terminal pane: jump to the vault and edit the host there.
  const editHostFromTab = (host: Host) => {
    setActive("vault");
    setHostForm(editDraft(host));
  };
  const editHost = (host: Host) => {
    setHostForm(editDraft(host));
    setError("");
  };
  const duplicateHost = (host: Host) => {
    setHostForm({
      ...editDraft(host),
      id: crypto.randomUUID(),
      name: `${host.name} (copia)`,
      fingerprint: "",
      os: null,
      lastConnectedAt: null,
    });
    setError("");
  };
  const newFolderIn = (parentId: string) => {
    setGroupForm(newGroup(parentId));
    setError("");
  };
  const newFolder = () => newFolderIn(group);
  const editGroup = (g: Group) => {
    setGroupForm({ ...g });
    setError("");
  };
  const editIdentity = (i: Identity) => {
    setError("");
    setIdentityForm({
      id: i.id,
      name: i.name,
      username: i.username,
      auth: i.auth,
      keyId: i.keyId,
      password: "",
    });
  };
  const editKey = (k: SshKey) => {
    setError("");
    setKeyForm({
      id: k.id,
      name: k.name,
      privateKey: "",
      passphrase: "",
      fingerprint: k.fingerprint,
    });
  };
  const newIdentityForm = () => {
    setIdentityForm(newIdentity());
    setError("");
  };
  const newKeyForm = () => {
    setKeyForm(newKey());
    setError("");
  };
  // The primary "new" button of the current page.
  const createNew = () => {
    setError("");
    if (page === "hosts") setHostForm(draftFor(group));
    if (page === "identities") setIdentityForm(newIdentity());
    if (page === "keys") setKeyForm(newKey());
  };
  const closeHostEditor = () => {
    if (hostForm && hostFormIsValid(hostForm) && hostAutosave.dirty) {
      void run(async () => {
        if (await hostAutosave.flush()) setHostForm(null);
      });
    } else {
      setHostForm(null);
      setError("");
    }
  };
  const submitHostEditor = () => {
    let saved: Host | null = null;
    void run(async () => {
      saved = await hostAutosave.flush();
      if (saved) setHostForm(null);
    }).then(() => {
      if (saved) connect(saved);
    });
  };
  const newFolderFromHost = (name: string) => {
    setGroupForm({ ...newGroup("", name), returnTo: "host" });
    setError("");
  };
  const closeGroupEditor = () => {
    setGroupForm(null);
    setError("");
  };
  const saveGroup = () =>
    void run(async () => {
      if (!groupForm) return;
      const { returnTo, ...saved } = groupForm;
      update(await invokeScoped<View>("save_group", { group: saved }));
      if (returnTo && hostForm)
        setHostForm({
          ...hostForm,
          groupId: saved.id,
          inheritIdentity:
            hostForm.identityId || hostForm.credentials?.username
              ? hostForm.inheritIdentity
              : !!saved.identityId,
        });
      closeGroupEditor();
      setNotice("Gruppo salvato");
    });
  const closeIdentityEditor = () => {
    setIdentityForm(null);
    setError("");
    if (hostForm)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            '[role="combobox"][aria-label="Identità"]',
          )
          ?.focus(),
      );
  };
  const saveIdentity = () =>
    void run(async () => {
      if (!identityForm) return;
      update(
        await invokeScoped<View>("save_identity", { identity: identityForm }),
      );
      if (hostForm) setHostForm({ ...hostForm, identityId: identityForm.id });
      closeIdentityEditor();
      setNotice("Identità salvata");
    });
  const closeKeyEditor = () => {
    setKeyForm(null);
    setError("");
    if (identityForm)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            '[role="combobox"][aria-label="Chiave dal portachiavi"]',
          )
          ?.focus(),
      );
  };
  const saveKey = () =>
    void run(async () => {
      if (!keyForm) return;
      update(await invokeScoped<View>("save_key", { key: keyForm }));
      if (identityForm) setIdentityForm({ ...identityForm, keyId: keyForm.id });
      closeKeyEditor();
      setNotice("Chiave salvata nel portachiavi");
    });
  // Everything tied to the vault being left.
  const reset = () => {
    setHostForm(null);
    setIdentityForm(null);
    setKeyForm(null);
  };
  // A form sheet is up: the page behind it is not reachable.
  const editing = !!(hostForm || groupForm || identityForm || keyForm);
  return {
    editing,
    hostForm,
    setHostForm,
    groupForm,
    setGroupForm,
    identityForm,
    setIdentityForm,
    keyForm,
    setKeyForm,
    hostAutosave,
    editorBlocksSync,
    newHostIn,
    editHost,
    editHostFromTab,
    duplicateHost,
    newFolder,
    newFolderIn,
    editGroup,
    editIdentity,
    editKey,
    newIdentityForm,
    newKeyForm,
    createNew,
    closeHostEditor,
    submitHostEditor,
    newFolderFromHost,
    closeGroupEditor,
    saveGroup,
    closeIdentityEditor,
    saveIdentity,
    closeKeyEditor,
    saveKey,
    reset,
  };
}
