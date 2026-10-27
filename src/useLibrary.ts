import { useEffect, useRef, useState } from "react";
import { groupPath, inheritedIdentity, subtreeIds } from "./groups.mjs";
import { hostDraftIsValid, hostInheritsIdentity } from "./host-draft";
import { newGroup, newHost, newIdentity, newKey } from "./types";
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
} from "./types";
import { useHostAutosave } from "./useHostAutosave";
import type { VaultApi } from "./useVault";

export type Page = "hosts" | "identities" | "keys";
export const pageLabels: Record<Page, string> = {
  hosts: "Host",
  identities: "Identità",
  keys: "Chiavi SSH",
};
export type Deletion = {
  kind: Page | "groups";
  id: string;
  name: string;
  ids?: string[];
};

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.toLowerCase());

/** The vault contents on screen: pages, search, selection, and the editors for hosts, groups, identities and keys. */
export function useLibrary(
  vault: VaultApi,
  tabs: { setActive: (id: string) => void; connect: (host: Host) => void },
) {
  const { view, busy, epoch, update, run, invokeScoped, setError, setNotice } =
    vault;
  const [page, setPage] = useState<Page>("hosts"),
    [group, setGroup] = useState(""),
    [query, setQuery] = useState(""),
    [usage, setUsage] = useState<{ ids: string[]; label: string } | null>(null),
    [sort, setSort] = useState<"name" | "recent">("name"),
    [layout, setLayout] = useState<"list" | "cards">("cards");
  const [hostForm, setHostForm] = useState<HostDraft | null>(null),
    [groupForm, setGroupForm] = useState<GroupForm | null>(null),
    [identityForm, setIdentityForm] = useState<IdentityForm | null>(null),
    [keyForm, setKeyForm] = useState<KeyForm | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set()),
    [bulkIdentity, setBulkIdentity] = useState(""),
    [bulkOpen, setBulkOpen] = useState(false),
    [deletion, setDeletion] = useState<Deletion | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const clearSelection = () => {
    setSelected(new Set());
    setSelectedFolders(new Set());
  };
  useEffect(() => {
    clearSelection();
  }, [group, query, page, view.vaultId]);
  useEffect(() => {
    const ids = new Set(view.hosts.map((h) => h.id));
    setSelected((old) =>
      [...old].every((id) => ids.has(id))
        ? old
        : new Set([...old].filter((id) => ids.has(id))),
    );
  }, [view.hosts]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`shellnest.layout.${view.vaultId}`);
      setLayout(saved === "list" ? "list" : "cards");
    } catch {
      setLayout("cards");
    }
  }, [view.vaultId]);
  const changeLayout = (value: "cards" | "list") => {
    setLayout(value);
    try {
      localStorage.setItem(`shellnest.layout.${view.vaultId}`, value);
    } catch {
      /* Preference storage is optional. */
    }
  };
  const hostAutosave = useHostAutosave(
    hostForm,
    view.hosts.find((h) => h.id === hostForm?.id),
    view.identities,
    view.groups,
    view.vaultId,
    busy || !!identityForm || !!keyForm || !!groupForm,
    async (draft) => {
      const generation = epoch.current;
      const {
        credentials,
        username,
        hasPassword,
        inheritIdentity,
        port: _effectivePort,
        ownPort,
        effectiveIdentityId: _effectiveIdentity,
        identitySource: _identitySource,
        ...host
      } = draft;
      const next = await invokeScoped<View>("save_host", {
        host: { ...host, port: ownPort },
        inherit: !!inheritIdentity,
        credentials:
          host.identityId || inheritIdentity
            ? null
            : (credentials ?? { username: username ?? "", password: "" }),
      });
      if (generation !== epoch.current)
        throw new Error("Il vault attivo è cambiato");
      update(next);
      return next.hosts.find((h) => h.id === draft.id)!;
    },
  );
  // Background sync waits while an editor holds input that cannot be saved yet.
  const editorBlocksSync = (panelOpen: boolean) =>
    panelOpen &&
    (!hostForm ||
      !hostDraftIsValid(
        hostForm,
        view.identities,
        view.hosts.find((h) => h.id === hostForm.id),
        view.groups,
      ));
  const identitiesById = new Map(view.identities.map((i) => [i.id, i]));
  const keysById = new Map(view.keys.map((k) => [k.id, k]));
  const navigate = (next: Page) => {
    setPage(next);
    tabs.setActive("vault");
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
    setError("");
  };
  const openGroup = (id: string) => {
    setGroup(id);
    clearSelection();
  };
  const showFolder = (id: string) => {
    navigate("hosts");
    setGroup(id);
  };
  const clearFilters = () => {
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
    search.current?.focus();
  };
  const showUsage = (ids: string[], label: string) => {
    navigate("hosts");
    setUsage({ ids, label });
  };
  const groupHostCount = (id: string) => {
    const ids = new Set(subtreeIds(view.groups, id));
    return view.hosts.filter((h) => ids.has(h.groupId)).length;
  };
  const draftFor = (groupId = ""): HostDraft => ({
    ...newHost(groupId),
    inheritIdentity: !!inheritedIdentity(view.groups, groupId),
  });
  const editDraft = (host: Host): HostDraft => ({
    ...host,
    inheritIdentity: hostInheritsIdentity(host),
  });
  const newHostIn = (groupId: string) => {
    tabs.setActive("vault");
    setHostForm(draftFor(groupId));
  };
  // From a terminal pane: jump to the vault and edit the host there.
  const editHostFromTab = (host: Host) => {
    tabs.setActive("vault");
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
  const askDelete = (next: Deletion) => {
    setDeletion(next);
    setError("");
  };
  const closeDeletion = () => {
    setDeletion(null);
    setError("");
  };
  const confirmDeletion = () =>
    void run(async () => {
      if (!deletion) return;
      const command =
        deletion.kind === "hosts"
          ? "delete_host"
          : deletion.kind === "identities"
            ? "delete_identity"
            : deletion.kind === "groups"
              ? "delete_group"
              : "delete_key";
      for (const id of deletion.ids ?? [deletion.id]) {
        update(await invokeScoped<View>(command, { id }));
      }
      if (deletion.kind === "groups" && deletion.id === group) setGroup("");
      setDeletion(null);
      setNotice(
        deletion.ids ? "Host selezionati eliminati" : "Elemento eliminato",
      );
    });
  const openBulkAssign = (hostIds: Set<string>, identityId = "") => {
    setSelected(hostIds);
    setBulkIdentity(identityId);
    setBulkOpen(true);
    setError("");
  };
  const closeBulkAssign = () => {
    setBulkOpen(false);
    setError("");
  };
  const assignIdentity = () =>
    void run(async () => {
      update(
        await invokeScoped<View>("assign_identity", {
          ids: [...selected],
          identityId: bulkIdentity,
        }),
      );
      setBulkOpen(false);
      clearSelection();
      setNotice("Identità assegnata agli host selezionati");
    });
  const closeHostEditor = () => {
    if (
      hostForm &&
      hostDraftIsValid(
        hostForm,
        view.identities,
        view.hosts.find((h) => h.id === hostForm.id),
        view.groups,
      ) &&
      hostAutosave.dirty
    ) {
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
      if (saved) tabs.connect(saved);
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
  const usageIds = usage && new Set(usage.ids);
  const hostRows = view.hosts
    .filter((h) => {
      const identity = identitiesById.get(
        h.effectiveIdentityId || h.identityId,
      );
      return (
        (!group || h.groupId === group) &&
        (!usageIds || usageIds.has(h.identityId)) &&
        matches(
          `${h.name} ${h.address} ${groupPath(view.groups, h.groupId)} ${identity?.name ?? ""} ${identity?.username ?? h.username ?? ""}`,
          query,
        )
      );
    })
    .sort((a, b) =>
      sort === "recent"
        ? (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0)
        : a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  const identityRows = view.identities
    .filter((i) =>
      matches(
        `${i.name} ${i.username} ${keysById.get(i.keyId)?.name ?? ""}`,
        query,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const keyRows = view.keys
    .filter((k) => matches(`${k.name} ${k.fingerprint}`, query))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Everything tied to the vault being left.
  const reset = () => {
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
    setHostForm(null);
    setIdentityForm(null);
    setKeyForm(null);
  };
  return {
    page,
    group,
    query,
    setQuery,
    usage,
    clearUsage: () => setUsage(null),
    sort,
    setSort,
    layout,
    changeLayout,
    search,
    hostForm,
    setHostForm,
    groupForm,
    setGroupForm,
    identityForm,
    setIdentityForm,
    keyForm,
    setKeyForm,
    selected,
    setSelected,
    selectedFolders,
    setSelectedFolders,
    clearSelection,
    bulkIdentity,
    setBulkIdentity,
    bulkOpen,
    setBulkOpen,
    deletion,
    hostAutosave,
    editorBlocksSync,
    navigate,
    openGroup,
    showFolder,
    clearFilters,
    showUsage,
    groupHostCount,
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
    askDelete,
    closeDeletion,
    confirmDeletion,
    openBulkAssign,
    closeBulkAssign,
    assignIdentity,
    closeHostEditor,
    submitHostEditor,
    newFolderFromHost,
    closeGroupEditor,
    saveGroup,
    closeIdentityEditor,
    saveIdentity,
    closeKeyEditor,
    saveKey,
    hostRows,
    identityRows,
    keyRows,
    reset,
  };
}
