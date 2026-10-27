import { HostSummary } from "./HostSummary";
import { desktop, mac } from "./platform";
import { useVault } from "./useVault";
import { useVaultSync } from "./useVaultSync";
import { useVaultSession } from "./useVaultSession";
import { useUnlock } from "./useUnlock";
import { useSettingsDialog } from "./useSettingsDialog";
import { usePreferences } from "./usePreferences";
import { useTabs } from "./useTabs";
import { useTabDrag } from "./useTabDrag";
import { useHostAutosave } from "./useHostAutosave";
import { hostDraftIsValid, hostInheritsIdentity } from "./host-draft";
import {
  ancestry,
  childGroups,
  groupOptions,
  groupPath,
  inheritedIdentity,
  subtreeIds,
} from "./groups.mjs";
import { GroupEditor } from "./GroupEditor";
import { AlertDialogDescription } from "./components/ui/alert-dialog";
import { SelectField } from "./SelectField";
import { IdentitiesTable, KeysTable } from "./CollectionTables";
import { NavItem } from "./NavItem";
import { BrandIcon } from "./BrandIcon";
import { trackOpener } from "./opener";

const filterTrigger =
  "h-[30px] gap-[7px] border-input bg-card pr-[8px] pl-[10px] text-[12px] hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--input))] hover:bg-accent [&>svg:first-child]:text-muted-foreground";
import { cn } from "./lib/utils";
import { TabShell, TabLead, TabMain, tabRenameClass } from "./Tab";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { PasswordInput } from "./PasswordInput";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from "./components/ui/dropdown-menu";
import { Fragment, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Cloud,
  Folder,
  FolderPlus,
  KeyRound,
  LockKeyhole,
  Plus,
  SquarePlus,
  Search,
  Server,
  Settings2,
  TerminalSquare,
  Trash2,
  UserRound,
  X,
  LayoutGrid,
  List,
  ArrowLeft,
  ArrowRight,
  Menu,
  RefreshCw,
} from "lucide-react";
import { WindowControls } from "./WindowControls";
import { TerminalPane, terminalHandles } from "./TerminalPane";
import { SettingsDialog } from "./SettingsDialog";
import { VaultSettings } from "./VaultSettings";
import { Switch } from "./components/ui/switch";
import { DEFAULT_FONT_SIZE, clampFontSize } from "./settings.mjs";
import { useCloseGuard } from "./CloseGuard";
import { actionFor } from "./shortcuts.mjs";
import { OsIcon } from "./OsIcon";
import { HostEditor, IdentityEditor, KeyEditor, Panel } from "./Editors";
import { HostsView } from "./HostsView";
import { VaultPicker } from "./VaultPicker";
import { ActionMenu } from "./ActionMenu";
import { ConnectionLauncher } from "./ConnectionLauncher";
import { dropEdge, leafIds } from "./workbench-state.mjs";
import { newGroup, newHost, newIdentity, newKey } from "./types";
import type {
  Host,
  HostDraft,
  Identity,
  IdentityForm,
  KeyForm,
  SshKey,
  TerminalTab,
  View,
  GroupForm,
} from "./types";
import "./theme.css";
import { callout, fingerprint, help, muted } from "./editor-ui";

if (import.meta.env.MODE === "desktop-e2e") {
  void import("@wdio/tauri-plugin");
}

const skeleton =
  "block animate-[shimmer_1.4s_linear_infinite] rounded-[12px] bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--card)_25%,color-mix(in_srgb,var(--card),white_8%)_50%,var(--card)_75%)]";
const dropPreviewEdge = {
  left: "inset-y-0 right-1/2 left-0",
  right: "inset-y-0 right-0 left-1/2",
  top: "inset-x-0 top-0 bottom-1/2",
  bottom: "inset-x-0 top-1/2 bottom-0",
} as const;
type Page = "hosts" | "identities" | "keys";
const labels: Record<Page, string> = {
  hosts: "Host",
  identities: "Identità",
  keys: "Chiavi SSH",
};
function App() {
  const vault = useVault();
  const {
    view,
    busy,
    busyRef,
    error,
    setError,
    notice,
    setNotice,
    preview,
    update,
    run,
    invokeScoped,
    epoch,
  } = vault;
  const unlock = useUnlock(vault);
  const [page, setPage] = useState<Page>("hosts"),
    [group, setGroup] = useState(""),
    [query, setQuery] = useState(""),
    [hostForm, setHostForm] = useState<HostDraft | null>(null),
    [groupForm, setGroupForm] = useState<GroupForm | null>(null),
    [identityForm, setIdentityForm] = useState<IdentityForm | null>(null),
    [keyForm, setKeyForm] = useState<KeyForm | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [bulkIdentity, setBulkIdentity] = useState(""),
    [bulkOpen, setBulkOpen] = useState(false);
  const clearSelection = () => {
    setSelected(new Set());
    setSelectedFolders(new Set());
  };
  useEffect(() => {
    clearSelection();
  }, [group, query, page, view.vaultId]);
  const settings = useSettingsDialog(vault);
  const [deletion, setDeletion] = useState<{
    kind: Page | "groups";
    id: string;
    name: string;
    ids?: string[];
  } | null>(null);
  const {
    appSettings,
    saveSettings,
    overrides,
    saveOverrides,
    bindings,
    hint,
  } = usePreferences();
  const [renaming, setRenaming] = useState<string>();
  const [usage, setUsage] = useState<{ ids: string[]; label: string } | null>(
    null,
  );
  const search = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<"list" | "cards">("cards");
  const [sort, setSort] = useState<"name" | "recent">("name");
  const closeGuard = useCloseGuard();
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
  useEffect(() => {
    const ids = new Set(view.hosts.map((h) => h.id));
    setSelected((old) =>
      [...old].every((id) => ids.has(id))
        ? old
        : new Set([...old].filter((id) => ids.has(id))),
    );
  }, [view.hosts]);
  const tabsApi = useTabs(vault, closeGuard);
  const {
    tabs,
    bar,
    active,
    setActive,
    focusedPane,
    setFocusedPane,
    focusOf,
    launcherOpen,
    launcherKey,
    savingWs,
    setSavingWs,
    trust,
    pendingClose,
    setPendingClose,
    splitTab,
    detachPane,
    connect,
    connectHosts,
    reopenTab,
    askClosePane,
    askCloseTab,
    activateTab,
    closeLauncher,
    openLauncher,
    openLocal,
    openQuick,
    quickConnect,
    openWorkspaces,
    lastSession,
    saveWorkspace,
    duplicateTab,
    approveTrust,
    rejectTrust,
    closeOthers,
    reorder,
    renameTab,
    resizeActive,
    tabStatus,
    tabTitle,
    closePane,
    reconnectPane,
  } = tabsApi;
  const {
    drag,
    setDrag,
    dragPane,
    setDragPane,
    dropHint,
    setDropHint,
    reflow,
    settling,
    clearSpring,
    clearDnd,
    springOpen,
    dropOn,
    geos,
    shown,
    dragging,
  } = useTabDrag({
    tabs,
    active,
    setActive,
    dropOnPane: tabsApi.dropOnPane,
  });
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
  const sync = useVaultSync(vault, {
    hostSaved: hostAutosave.status === "saved",
    canAutoSync: () =>
      !anyPanel ||
      (!!hostForm &&
        hostDraftIsValid(
          hostForm,
          view.identities,
          view.hosts.find((h) => h.id === hostForm.id),
          view.groups,
        )),
  });
  const { synchronize, syncState, lastSync } = sync;
  const session = useVaultSession({
    vault,
    tabs: { tabs, reset: tabsApi.reset },
    sync,
    hideSettings: settings.hide,
    onReset: () => {
      setQuery("");
      setGroup("");
      setUsage(null);
      clearSelection();
      unlock.reset();
      settings.clearToken();
      setHostForm(null);
      setIdentityForm(null);
      setKeyForm(null);
    },
  });
  const {
    vaultDialog,
    setVaultDialog,
    pendingSwitch,
    setPendingSwitch,
    pendingLock,
    setPendingLock,
    lockVault,
    requestSwitch,
    requestLock,
  } = session;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        !view.unlocked ||
        busyRef.current ||
        hostForm ||
        identityForm ||
        keyForm ||
        settings.section ||
        bulkOpen ||
        deletion ||
        trust ||
        vaultDialog ||
        pendingSwitch ||
        pendingClose ||
        closeGuard.open ||
        pendingLock
      )
        return;
      const action = actionFor(e, mac, bindings);
      if (!action) {
        if (e.key === "Escape" && active === "vault") clearSelection();
        return;
      }
      const leader = tabs.find((t) => t.id === active);
      const order = tabs.filter((t) => !t.parent),
        items = [
          "vault",
          ...order.map((t) => t.id),
          ...(launcherOpen ? ["launcher"] : []),
        ];
      const cycle = (step: number) => {
        const at = Math.max(0, items.indexOf(active));
        setActive(items[(at + step + items.length) % items.length]);
      };
      const stepPane = (step: number) => {
        if (!leader?.layout) return false;
        const ids = leafIds(leader.layout);
        setFocusedPane(
          ids[(ids.indexOf(focusOf(leader)) + step + ids.length) % ids.length],
        );
        return true;
      };
      const moveTab = (step: number) => {
        const to = leader && order[order.indexOf(leader) + step];
        if (leader && to) reorder(leader.id, to.id);
        return !!leader;
      };
      const zoom = (to: number) =>
        saveSettings({ ...appSettings, fontSize: clampFontSize(to) });
      const handled: Record<string, () => boolean | void> = {
        quickConnect: openLauncher,
        newHost: () => {
          setActive("vault");
          setHostForm(draftFor());
        },
        newFolder: () => {
          setActive("vault");
          newFolder();
        },
        searchVault: () => {
          setActive("vault");
          requestAnimationFrame(() => search.current?.focus());
        },
        lockVault: requestLock,
        openSettings: () => settings.open(),
        closePane: () =>
          active === "launcher"
            ? closeLauncher()
            : leader && askClosePane(focusOf(leader)),
        closeWorkspace: () => leader && askCloseTab(leader.id),
        reopenTab: reopenTab,
        gotoTab: () => {
          const n = +(e.code.startsWith("Digit") ? e.code.slice(5) : e.key);
          setActive(
            n === 9 ? items[items.length - 1] : (items[n - 1] ?? active),
          );
        },
        prevTab: () => cycle(-1),
        nextTab: () => cycle(1),
        moveTabLeft: () => moveTab(-1),
        moveTabRight: () => moveTab(1),
        splitRight: () => leader && splitTab(leader.id, "row"),
        splitDown: () => leader && splitTab(leader.id, "col"),
        prevPane: () => stepPane(-1),
        nextPane: () => stepPane(1),
        clearTerminal: () =>
          leader && terminalHandles.get(focusOf(leader))?.clear(),
        zoomIn: () => zoom(appSettings.fontSize + 1),
        zoomOut: () => zoom(appSettings.fontSize - 1),
        zoomReset: () => zoom(DEFAULT_FONT_SIZE),
      };
      // Pane stepping falls through to the terminal when the tab is not split.
      if (handled[action]() === false) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [
    view,
    hostForm,
    identityForm,
    keyForm,
    settings.section,
    bulkOpen,
    deletion,
    trust,
    active,
    preview,
    vaultDialog,
    pendingSwitch,
    pendingClose,
    closeGuard.open,
    pendingLock,
    tabs,
    focusedPane,
    launcherOpen,
    appSettings,
    bindings,
  ]);
  useEffect(() => {
    document
      .querySelector(".tab.selected")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, tabs.length]);
  const navigate = (next: Page) => {
    setPage(next);
    setActive("vault");
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
    setError("");
  };
  const identity = (host: Host) =>
    view.identities.find(
      (i) => i.id === (host.effectiveIdentityId || host.identityId),
    );
  const terminals = useRef<HTMLDivElement>(null);
  const tabIcon = (t: TerminalTab) =>
    t.layout ? (
      <LayoutGrid size={14} />
    ) : t.kind === "ssh" ? (
      <OsIcon
        size="tab"
        os={view.hosts.find((h) => h.id === t.host.id)?.os ?? t.host.os}
      />
    ) : (
      <TerminalSquare size={14} />
    );
  const tabLabel = (t: TerminalTab) =>
    t.name ?? (t.layout ? "Workspace" : t.termTitle || t.title);
  const skippedQuick = (() => {
    const layout = tabs.find((t) => t.id === savingWs?.tabId)?.layout;
    return layout
      ? leafIds(layout).filter(
          (id) => tabs.find((t) => t.id === id)?.kind === "quick",
        ).length
      : 0;
  })();
  const showUsage = (ids: string[], label: string) => {
    navigate("hosts");
    setUsage({ ids, label });
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
  const closeGroupEditor = () => {
    setGroupForm(null);
    setError("");
  };
  const hostRows = view.hosts
    .filter(
      (h) =>
        (!group || h.groupId === group) &&
        (!usage || usage.ids.includes(h.identityId)) &&
        `${h.name} ${h.address} ${groupPath(view.groups, h.groupId)} ${identity(h)?.name ?? ""} ${identity(h)?.username ?? h.username ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "recent"
        ? (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0)
        : a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  const identityRows = view.identities
    .filter((i) =>
      `${i.name} ${i.username} ${view.keys.find((k) => k.id === i.keyId)?.name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const keyRows = view.keys
    .filter((k) =>
      `${k.name} ${k.fingerprint}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const anyPanel = !!(
    hostForm ||
    groupForm ||
    identityForm ||
    keyForm ||
    settings.section ||
    trust ||
    deletion ||
    bulkOpen ||
    vaultDialog ||
    pendingSwitch ||
    pendingClose ||
    pendingLock
  );
  const alert =
    error && !anyPanel ? (
      <div
        className="flex shrink-0 items-center gap-[10px] px-[22px] py-[10px] text-[13px] border-b border-destructive/20 bg-destructive/[0.07] [overflow-wrap:anywhere] text-destructive"
        role="alert"
      >
        <span>{error}</span>
        <Button
          variant="ghost"
          type="button"
          aria-label="Chiudi errore"
          className="ml-auto w-[25px] p-0"
          onClick={() => setError("")}
        >
          <X size={16} />
        </Button>
      </div>
    ) : null;
  const newFolder = () => {
    setGroupForm(newGroup(group));
    setError("");
  };
  const onNew = () => {
    setError("");
    if (page === "hosts") setHostForm(draftFor(group));
    if (page === "identities") setIdentityForm(newIdentity());
    if (page === "keys") setKeyForm(newKey());
  };
  const vaultPicker = (
    <VaultPicker
      view={view}
      busy={busy}
      disabled={anyPanel}
      onSelect={requestSwitch}
      onCreate={session.openCreateDialog}
      onRename={session.openRenameDialog}
    />
  );
  const vaultPanels = (
    <>
      {vaultDialog && (
        <Panel
          variant="dialog"
          title={
            vaultDialog.mode === "create" ? "Nuovo vault" : "Rinomina vault"
          }
          busy={busy}
          error={error}
          onClose={() => {
            setVaultDialog(null);
            setError("");
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              session.submitVaultDialog();
            }}
          >
            <label>
              Nome
              <Input
                autoFocus
                required
                maxLength={80}
                value={vaultDialog.name}
                onChange={(e) =>
                  setVaultDialog({ ...vaultDialog, name: e.target.value })
                }
                placeholder="Personale, Lavoro, Cliente…"
              />
            </label>
            {vaultDialog.mode === "create" && (
              <>
                <p className={help}>
                  Il nuovo vault avrà host, identità, chiavi e password
                  principale propri. Dopo la creazione scegli la sua password
                  oppure collega un vault remoto esistente.
                </p>
                {tabs.length > 0 && (
                  <div className={callout}>
                    La creazione seleziona il nuovo vault e chiude tutte le{" "}
                    {tabs.length} sessioni aperte, incluse le shell locali.
                  </div>
                )}
              </>
            )}
            <footer>
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => setVaultDialog(null)}
              >
                Annulla
              </Button>
              <Button
                variant="default"
                type="submit"
                className="primary"
                disabled={busy}
              >
                {vaultDialog.mode === "create" ? "Crea vault" : "Salva nome"}
              </Button>
            </footer>
          </form>
        </Panel>
      )}
      {pendingSwitch && (
        <Panel
          variant="alert"
          title="Cambia vault"
          busy={busy}
          error={error}
          onClose={() => setPendingSwitch(null)}
        >
          <AlertDialogDescription>
            Passare a{" "}
            <strong>
              {view.vaults.find((v) => v.id === pendingSwitch)?.name}
            </strong>
            ?
          </AlertDialogDescription>
          <div className={callout}>
            Verranno chiuse tutte le {tabs.length} sessioni aperte, incluse le
            shell locali. Il vault attuale verrà bloccato.
          </div>
          <footer>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => session.switchVault(pendingSwitch)}
            >
              Chiudi sessioni e cambia
            </Button>
          </footer>
        </Panel>
      )}
      {pendingClose && (
        <Panel
          variant="alert"
          title="Chiudi altre sessioni"
          busy={busy}
          error={error}
          onClose={() => setPendingClose(null)}
        >
          <AlertDialogDescription>
            Chiudere {pendingClose.length} sessioni? Le shell locali e le
            connessioni SSH selezionate verranno terminate.
          </AlertDialogDescription>
          <footer>
            <Button
              variant="destructive"
              type="button"
              disabled={busy}
              className="danger"
              onClick={closeOthers}
            >
              Chiudi sessioni
            </Button>
          </footer>
        </Panel>
      )}
      {closeGuard.dialog}
      {pendingLock && (
        <Panel
          variant="alert"
          title="Blocca vault"
          busy={busy}
          error={error}
          onClose={() => setPendingLock(false)}
        >
          <AlertDialogDescription>
            Bloccare il vault e chiudere tutte le {tabs.length} sessioni,
            incluse le shell locali?
          </AlertDialogDescription>
          <footer>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={lockVault}
            >
              Chiudi sessioni e blocca
            </Button>
          </footer>
        </Panel>
      )}
    </>
  );
  if (vault.opening)
    return (
      <main className="relative grid h-dvh place-items-center overflow-auto px-[20px] pt-[64px] pb-[24px]">
        <header
          className="absolute inset-x-0 top-0 flex h-[46px] items-stretch justify-between bg-header select-none"
          data-tauri-drag-region
        >
          <span
            className="flex-1 px-[18px] py-[14px] text-[13px] text-muted-foreground [.mac_&]:hidden"
            data-tauri-drag-region
          >
            Shellnest
          </span>
          <WindowControls onError={setError} />
        </header>
        <div
          className="m-auto grid w-[min(420px,80vw)] gap-[12px] [&>.skeleton]:h-[56px] [&>.skeleton:first-child]:h-[72px]"
          role="status"
          aria-label="Apertura vault"
        >
          <span className={skeleton} />
          <span className={skeleton} />
          <span className={skeleton} />
        </div>
      </main>
    );
  if (!view.unlocked)
    return (
      <main className="relative grid h-dvh place-items-center overflow-auto px-[20px] pt-[64px] pb-[24px]">
        <header
          className="absolute inset-x-0 top-0 flex h-[46px] items-stretch justify-between bg-header select-none"
          data-tauri-drag-region
        >
          <span
            className="flex-1 px-[18px] py-[14px] text-[13px] text-muted-foreground [.mac_&]:hidden"
            data-tauri-drag-region
          >
            Shellnest
          </span>
          <WindowControls onError={setError} />
        </header>
        <section className="w-[370px] max-w-full [&_form]:mt-[25px] [&_input]:h-[40px] [&_input]:text-[15px]">
          <div className="mb-[32px] flex items-center gap-[9px] text-[13px] font-semibold whitespace-nowrap">
            <BrandIcon />
            Shellnest
            <span className="ml-auto text-[12px] font-normal text-muted-foreground">
              {desktop ? "0.3 · In sviluppo" : "Anteprima browser"}
            </span>
          </div>
          {(desktop || preview) && (
            <div className="[&>button]:mb-[24px]">{vaultPicker}</div>
          )}
          <h1 className="mb-[12px] text-[22px]">
            {view.exists
              ? "Sblocca vault"
              : unlock.restore
                ? "Collega dispositivo"
                : desktop || preview
                  ? "Crea vault locale"
                  : "Esplora Shellnest"}
          </h1>
          <p className={muted}>
            {!desktop && !preview
              ? "Client SSH open source per Windows e macOS, con sincronizzazione self-hosted opzionale."
              : view.exists
                ? "Inserisci la password principale."
                : unlock.restore
                  ? "Apri il vault già presente nel tuo servizio di sincronizzazione."
                  : "Host, identità e chiavi SSH vengono salvati sul dispositivo, cifrati."}
          </p>
          {preview && (
            <p className={callout}>
              Anteprima in memoria: usa una password fittizia. Nessun dato viene
              cifrato o conservato dopo il ricaricamento.
            </p>
          )}
          {alert}
          {desktop || preview ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                unlock.submit();
              }}
            >
              {unlock.restore && (
                <>
                  <label>
                    URL completo del vault remoto
                    <Input
                      required
                      type="url"
                      value={unlock.url}
                      onChange={(e) => unlock.setUrl(e.target.value)}
                      placeholder="https://sync.example.com"
                    />
                  </label>
                  <label>
                    Token
                    <PasswordInput
                      autoComplete="off"
                      required
                      value={unlock.token}
                      onChange={(e) => unlock.setToken(e.target.value)}
                    />
                  </label>
                </>
              )}
              {unlock.restore && (
                <p className={help}>
                  Copia l’URL completo dalle impostazioni dell’altro
                  dispositivo, incluso /vaults/… quando presente.
                </p>
              )}
              <label>
                Password principale
                <PasswordInput
                  autoFocus

                  autoComplete={
                    view.exists ? "current-password" : "new-password"
                  }
                  minLength={view.exists || unlock.restore ? 1 : 12}
                  required
                  value={unlock.password}
                  onChange={(e) => unlock.setPassword(e.target.value)}
                />
              </label>
              {!view.exists && !unlock.restore && (
                <label>
                  Conferma password
                  <PasswordInput
                    autoComplete="new-password"
                    required
                    value={unlock.confirmPassword}
                    onChange={(e) => unlock.setConfirmPassword(e.target.value)}
                  />
                </label>
              )}
              {desktop && !unlock.restore && (
                <div className="mt-[16px] flex items-center justify-between gap-[12px] text-[13px]">
                  Ricorda su questo dispositivo
                  <Switch
                    label="Ricorda su questo dispositivo"
                    checked={unlock.remember}
                    onChange={unlock.setRemember}
                  />
                </div>
              )}
              <Button
                variant="default"
                type="submit"
                className="mt-[8px] h-[40px] w-full"
                disabled={busy}
              >
                {busy
                  ? "Attendi…"
                  : view.exists
                    ? "Sblocca"
                    : unlock.restore
                      ? "Collega dispositivo"
                      : "Crea vault"}
              </Button>
            </form>
          ) : (
            <>
              <div className={callout}>
                Prova gli stessi form e le stesse azioni con dati fittizi in
                memoria. SSH e cifratura richiedono l’app desktop.
              </div>
              <Button
                variant="default"
                type="button"
                className="mt-[8px] h-[40px] w-full"
                onClick={vault.startPreview}
              >
                Esplora interfaccia
              </Button>
            </>
          )}
          {desktop && !view.exists && (
            <Button
              variant="link"
              type="button"
              className="mx-auto my-[18px] flex"
              onClick={unlock.toggleRestore}
              disabled={busy}
            >
              {unlock.restore
                ? "Crea un vault locale"
                : "Collega un vault esistente"}
            </Button>
          )}
          <p className="mt-[28px] text-[12px] leading-[1.7] text-muted-foreground">
            La sincronizzazione è opzionale. Nessun account necessario per l’uso
            locale.
          </p>
          {(desktop || preview) && !view.exists && !unlock.restore && (
            <p className={help}>
              Usa almeno 12 caratteri. La password principale non è
              recuperabile: conservala in un gestore di password.
            </p>
          )}
        </section>
        {vaultPanels}
      </main>
    );
  return (
    <div
      className={cn(
        "app grid h-dvh grid-rows-[46px_minmax(0,1fr)] overflow-hidden [--sidebar-width:196px] max-[1100px]:[--sidebar-width:180px] max-[760px]:[--sidebar-width:60px]",
        active === "vault"
          ? "grid-cols-[var(--sidebar-width)_minmax(0,1fr)] [body.sheet-open_&]:grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--sheet-width)] max-[1100px]:[body.sheet-open_&]:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
          : "no-sidebar grid-cols-[minmax(0,1fr)]",
      )}
    >
      <header
        className="col-span-full flex min-w-0 items-stretch border-b border-border bg-header select-none"
        data-tauri-drag-region
      >
        <div
          className="flex w-[var(--sidebar-width)] shrink-0 items-center gap-[9px] px-[16px] text-[13px] font-semibold whitespace-nowrap [.mac_&]:w-[82px]"
          data-tauri-drag-region
        >
          <BrandIcon className="[.mac_&]:hidden" />
          <span
            className="overflow-hidden text-[13px] text-ellipsis max-[760px]:hidden [.mac_&]:hidden"
            data-tauri-drag-region
          >
            Shellnest
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="mx-[6px] inline-flex size-[30px] shrink-0 items-center justify-center self-center rounded-[9px] border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Menu applicazione"
            title="Menu applicazione"
          >
            <Menu size={18} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60"
            aria-label="Menu applicazione"
          >
            <DropdownMenuItem onClick={() => navigate("hosts")}>
              <Server size={15} />
              Host e cartelle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("identities")}>
              <UserRound size={15} />
              Identità
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("keys")}>
              <KeyRound size={15} />
              Chiavi SSH
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={busy}
              onClick={() => {
                setActive("vault");
                setHostForm(draftFor(group));
              }}
            >
              <Plus size={15} />
              Nuovo host
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={openLauncher}>
              <Plus size={15} />
              Nuova tab{" "}
              {hint("quickConnect") && <kbd>{hint("quickConnect")}</kbd>}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={openLocal}>
              <TerminalSquare size={15} />
              Terminale locale
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={busy} onClick={() => settings.open()}>
              <Settings2 size={15} />
              Impostazioni
              {hint("openSettings") && (
                <kbd className="ml-auto">{hint("openSettings")}</kbd>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy || !tabs.length}
              onClick={() => setPendingClose(tabs.map((t) => t.id))}
            >
              Chiudi tutte le sessioni
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={busy} onClick={requestLock}>
              <LockKeyhole size={15} />
              Blocca vault
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!desktop}
              onClick={() =>
                void getCurrentWindow()
                  .minimize()
                  .catch((e) => setError(String(e)))
              }
            >
              Riduci a icona
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!desktop}
              onClick={() =>
                void getCurrentWindow()
                  .toggleMaximize()
                  .catch((e) => setError(String(e)))
              }
            >
              Massimizza / ripristina finestra
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!desktop || busy}
              onClick={() =>
                void getCurrentWindow()
                  .close()
                  .catch((e) => setError(String(e)))
              }
            >
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div
          className="flex min-w-0 flex-1 items-center gap-[6px] overflow-x-auto px-[8px] py-[5px]"
          onDragOver={(e) => {
            if (dragPane) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
            const r = e.currentTarget.getBoundingClientRect();
            if (e.clientX - r.left < 48) e.currentTarget.scrollLeft -= 14;
            else if (r.right - e.clientX < 48) e.currentTarget.scrollLeft += 14;
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              clearSpring();
          }}
          onDrop={(e) => {
            if (!dragPane) return;
            e.preventDefault();
            detachPane(dragPane);
            clearDnd();
          }}
          role="navigation"
          aria-label="Sessioni e connessioni"
          data-tauri-drag-region
        >
          <TabShell
            fixed
            selected={active === "vault"}
            onClick={() => setActive("vault")}
          >
            <TabLead icon={<Server size={14} />} />
            <TabMain
              aria-current={active === "vault" ? "page" : undefined}
              onClick={() => setActive("vault")}
            >
              Vault
            </TabMain>
          </TabShell>
          {bar.map((tab) => (
            <TabShell
              key={tab.id}
              selected={active === tab.id}
              dragging={drag?.id === tab.id}
              drop={
                drag?.over === tab.id
                  ? drag.after
                    ? "after"
                    : "before"
                  : undefined
              }
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("application/x-shellnest-tab", tab.id);
                setDrag({ id: tab.id });
              }}
              onDragEnd={clearDnd}
              onDragOver={(e) => {
                if (
                  !e.dataTransfer.types.includes("application/x-shellnest-tab")
                )
                  return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                springOpen(tab.id);
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientX > r.left + r.width / 2;
                setDrag((d) =>
                  d && (d.over !== tab.id || d.after !== after)
                    ? { ...d, over: tab.id, after }
                    : d,
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                const moving = e.dataTransfer.getData(
                  "application/x-shellnest-tab",
                );
                reorder(moving, tab.id);
                clearDnd();
              }}
            >
              <TabLead
                icon={tabIcon(tab)}
                onClose={() => askCloseTab(tab.id)}
                label={tabLabel(tab)}
              />
              {renaming === tab.id ? (
                <input
                  className={tabRenameClass}
                  autoFocus
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  defaultValue={tabLabel(tab)}
                  aria-label="Nome scheda"
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    const name = e.currentTarget.value.trim();
                    renameTab(tab.id, name || undefined);
                    setRenaming(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(undefined);
                  }}
                />
              ) : (
                <TabMain
                  aria-current={active === tab.id ? "page" : undefined}
                  title={tabLabel(tab)}
                  onClick={() => setActive(tab.id)}
                  onDoubleClick={() => setRenaming(tab.id)}
                >
                  {tabLabel(tab)}
                </TabMain>
              )}
              <ActionMenu
                label={`Azioni scheda ${tab.title}`}
                className="size-[24px] text-inherit opacity-0 transition-opacity group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 group-data-[selected]/tab:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none"
              >
                {tab.layout && (
                  <DropdownMenuItem
                    onClick={() =>
                      setSavingWs({ tabId: tab.id, name: tab.name ?? "" })
                    }
                  >
                    Salva come workspace…
                  </DropdownMenuItem>
                )}
                {tab.layout && (
                  <DropdownMenuItem onClick={() => askClosePane(focusOf(tab))}>
                    Chiudi pannello attivo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setRenaming(tab.id)}>
                  Rinomina
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateTab(tab)}>
                  Duplica sessione
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateTab(tab, true)}>
                  Riconnetti
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={bar.length < 2}
                  onClick={() =>
                    setPendingClose(
                      tabs
                        .filter((t) => t.id !== tab.id && t.parent !== tab.id)
                        .map((t) => t.id),
                    )
                  }
                >
                  Chiudi altre sessioni
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={bar[0].id === tab.id}
                  onClick={() => {
                    const index = bar.findIndex((t) => t.id === tab.id);
                    reorder(tab.id, bar[index - 1].id);
                  }}
                >
                  <ArrowLeft size={12} />
                  Sposta a sinistra
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={bar[bar.length - 1].id === tab.id}
                  onClick={() => {
                    const index = bar.findIndex((t) => t.id === tab.id);
                    reorder(tab.id, bar[index + 1].id);
                  }}
                >
                  <ArrowRight size={12} />
                  Sposta a destra
                </DropdownMenuItem>
              </ActionMenu>
            </TabShell>
          ))}
          {launcherOpen && (
            <TabShell className="w-[170px]" selected={active === "launcher"}>
              <TabLead
                icon={<SquarePlus size={15} />}
                onClose={closeLauncher}
                label="nuova scheda"
              />
              <TabMain
                aria-current={active === "launcher" ? "page" : undefined}
                onClick={() => setActive("launcher")}
              >
                Nuova scheda
              </TabMain>
            </TabShell>
          )}
          <Button
            variant="ghost"
            type="button"
            className="size-[30px] shrink-0 rounded-[9px] p-0 text-muted-foreground"
            aria-label="Nuova connessione"
            title={["Nuova connessione", hint("quickConnect")]
              .filter(Boolean)
              .join(" · ")}
            onClick={openLauncher}
          >
            <Plus size={18} />
          </Button>
          <span
            className="min-w-[28px] flex-1 self-stretch"
            data-tauri-drag-region
          />
          <Button
            variant="ghost"
            type="button"
            className="h-[28px] shrink-0 gap-[6px] px-[8px] text-[12px] text-muted-foreground disabled:opacity-70 max-[760px]:hidden"
            title={
              view.syncConfigured
                ? lastSync
                  ? `Ultima sincronizzazione riuscita: ${lastSync}`
                  : "Sincronizza ora"
                : "Configura il tuo servizio di sincronizzazione"
            }
            disabled={busy || syncState === "syncing" || preview}
            onClick={() => {
              if (view.syncConfigured) void synchronize(true);
              else settings.open("vault");
            }}
            aria-live="polite"
          >
            {syncState === "syncing" ? (
              <RefreshCw size={14} />
            ) : (
              <Cloud size={14} />
            )}
            {syncState === "syncing"
              ? "Sincronizzazione…"
              : syncState === "error"
                ? "Sync non riuscita · Riprova"
                : view.syncConfigured
                  ? view.dirty
                    ? "Da sincronizzare"
                    : lastSync
                      ? `Sync ${lastSync}`
                      : "Sync configurata"
                  : null}
          </Button>
        </div>
        <WindowControls onError={setError} />
      </header>
      <aside
        className={cn(
          "flex min-h-0 flex-col border-r border-border bg-sidebar px-[10px] pt-[14px] max-[760px]:px-[8px] max-[760px]:pt-[12px]",
          active !== "vault" && "hidden",
        )}
      >
        {vaultPicker}
        <nav aria-label="Navigazione principale">
          {(["hosts", "identities", "keys"] as Page[]).map((p) => {
            const Icon =
              p === "hosts"
                ? Server
                : p === "identities"
                  ? UserRound
                  : KeyRound;
            return (
              <NavItem
                key={p}
                icon={<Icon size={16} />}
                label={labels[p]}
                count={
                  p === "hosts"
                    ? view.hosts.length
                    : p === "identities"
                      ? view.identities.length
                      : view.keys.length
                }
                active={page === p && active === "vault"}
                aria-label={labels[p]}
                title={labels[p]}
                onClick={() => navigate(p)}
              />
            );
          })}
        </nav>
        {view.groups.length > 0 && (
          <nav
            className="mt-[24px] min-h-0 overflow-y-auto max-[760px]:hidden"
            aria-label="Cartelle host"
          >
            <h2 className="px-[11px] pb-[8px] text-[12px] text-muted-foreground">
              Cartelle
            </h2>
            {childGroups(view.groups, "").map((g) => {
              const current =
                page === "hosts" &&
                active === "vault" &&
                ancestry(view.groups, group).some((a) => a.id === g.id);
              return (
                <NavItem
                  key={g.id}
                  icon={<Folder size={15} />}
                  label={g.name}
                  count={groupHostCount(g.id)}
                  active={current}
                  aria-label={`Cartella ${g.name}`}
                  title={g.name}
                  onClick={() => {
                    navigate("hosts");
                    setGroup(g.id);
                  }}
                />
              );
            })}
          </nav>
        )}
      </aside>
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        {preview && (
          <div className="border-b border-[#c99b4920] bg-[#c99b4910] px-[22px] py-[6px] text-[12px] text-[#c4af83]">
            Anteprima interattiva · Usa dati fittizi · Modifiche azzerate al
            ricaricamento
          </div>
        )}
        {alert}
        {notice && (
          <div
            className="flex shrink-0 items-center gap-[10px] px-[22px] py-[10px] text-[13px] border-b border-[#76c5a025] bg-[#76c5a012] text-[#9dd5b9]"
            role="status"
          >
            <Check size={14} />
            {notice}
          </div>
        )}
        {active === "launcher" && (
          <ConnectionLauncher
            shortcut={hint("quickConnect")}
            key={`${view.vaultId}-${launcherKey}`}
            vaultName={view.vaultName}
            groups={view.groups}
            workspaces={view.workspaces}
            hosts={view.hosts}
            identities={view.identities}
            tabs={bar.map((t) => ({
              id: t.id,
              title: t.title,
              subtitle:
                t.kind === "local"
                  ? "Terminale locale"
                  : t.kind === "ssh"
                    ? `${t.username}@${t.host.address}`
                    : `${t.username}@${t.target.address}`,
            }))}
            onConnect={connect}
            onOpenWorkspace={(ws) => void run(() => openWorkspaces([ws]))}
            session={lastSession()}
            onRestore={() => {
              const saved = lastSession();
              if (saved)
                void run(() =>
                  openWorkspaces(saved.items, view.hosts, saved.active),
                );
            }}
            onCreateWorkspace={(hostIds) => setSavingWs({ hostIds, name: "" })}
            onDeleteWorkspace={(ws) =>
              void run(async () => {
                update(
                  await invokeScoped<View>("delete_workspace", { id: ws.id }),
                );
              })
            }
            onActivateTab={activateTab}
            onLocalTerminal={openLocal}
            onQuickConnect={quickConnect}
            preview={preview}
            busy={busy}
          />
        )}
        {active === "vault" && (
          <section className="relative flex min-h-0 flex-1 flex-col">
            <header className="flex items-center gap-[16px] px-[22px] pt-[24px] max-[1100px]:px-[18px] max-[760px]:flex-wrap max-[760px]:gap-[8px] max-[760px]:pt-[12px]">
              <div className="flex min-w-0 flex-1 items-baseline gap-[10px]">
                <h1 className="overflow-hidden text-[22px] text-ellipsis whitespace-nowrap">
                  {page === "hosts" && group
                    ? (view.groups.find((g) => g.id === group)?.name ??
                      labels[page])
                    : labels[page]}
                </h1>
                <span
                  className="text-[12px] whitespace-nowrap text-muted-foreground"
                  role="status"
                >
                  {page === "hosts"
                    ? hostRows.length
                    : page === "identities"
                      ? identityRows.length
                      : keyRows.length}
                </span>
              </div>
              {page === "hosts" && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={openLauncher}
                  title={hint("quickConnect") || undefined}
                >
                  <TerminalSquare size={15} />
                  Connessione rapida
                </Button>
              )}
            </header>
            <div className="px-[22px] py-[14px] max-[1100px]:px-[18px]">
              <div className="flex w-full items-center gap-[9px] rounded-[7px] border border-border bg-field px-[12px] text-muted-foreground focus-within:border-ring">
                <Search size={16} />
                <Input
                  ref={search}
                  className="h-[36px] flex-1 rounded-none border-0 bg-transparent px-0 py-[7px] shadow-none outline-none focus-visible:border-0 focus-visible:outline-none"
                  aria-label="Cerca"
                  placeholder={
                    page === "hosts"
                      ? "Cerca nome, indirizzo o identità…"
                      : page === "identities"
                        ? "Cerca identità, utente o chiave…"
                        : "Cerca chiave o impronta…"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <Button
                    variant="ghost"
                    aria-label="Cancella ricerca"
                    onClick={() => setQuery("")}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-[14px] flex shrink-0 items-center gap-[8px] border-b border-border px-[22px] pb-[14px] max-[1100px]:px-[18px] max-[760px]:flex-wrap">
              <div className="inline-flex items-stretch">
                <Button
                  variant="default"
                  type="button"
                  className={cn(
                    "h-[30px] bg-clip-border focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/60",
                    page === "hosts" && "rounded-r-none",
                  )}
                  disabled={busy}
                  onClick={onNew}
                  title={
                    page === "hosts" ? hint("newHost") || undefined : undefined
                  }
                >
                  <Plus size={15} />
                  {page === "hosts"
                    ? "Nuovo host"
                    : page === "identities"
                      ? "Nuova identità"
                      : "Importa chiave"}
                </Button>
                {page === "hosts" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="default"
                          type="button"
                          className="h-[30px] w-[28px] rounded-l-none bg-clip-border px-0 shadow-[inset_1px_0_0_rgb(0_0_0/0.22)] aria-expanded:brightness-110 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/60"
                        />
                      }
                      aria-label="Altre azioni di creazione"
                      disabled={busy}
                    >
                      <ChevronDown size={15} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-56">
                      <DropdownMenuItem onClick={onNew}>
                        <Plus size={14} />
                        Nuovo host
                        <DropdownMenuShortcut>
                          {hint("newHost")}
                        </DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={newFolder}>
                        <FolderPlus size={14} />
                        Nuova cartella
                        <DropdownMenuShortcut>
                          {hint("newFolder")}
                        </DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {page === "hosts" && (
                <Button
                  variant="ghost"
                  type="button"
                  className="h-[30px] gap-[6px] px-[10px] text-muted-foreground max-[760px]:w-[30px] max-[760px]:text-[0px]"
                  disabled={busy || preview}
                  onClick={openLocal}
                >
                  <TerminalSquare size={16} />
                  Terminale locale
                </Button>
              )}
              <span className="flex-1 max-[760px]:min-w-[20px]" />
              {page === "hosts" && (
                <>
                  <SelectField
                    className={cn(
                      filterTrigger,
                      "hidden w-[160px] max-[760px]:flex",
                    )}
                    icon={<Folder size={14} />}
                    aria-label="Filtra per cartella"
                    placeholder="Tutte le cartelle"
                    value={group}
                    onValueChange={(value) => {
                      setGroup(value);
                      clearSelection();
                    }}
                    options={[
                      { value: "", label: "Tutte le cartelle" },
                      ...groupOptions(view.groups).map((o) => ({
                        value: o.group.id,
                        label: o.path,
                      })),
                    ]}
                  />
                  <SelectField
                    className={cn(filterTrigger, "w-auto min-w-[150px]")}
                    icon={<ArrowUpDown size={14} />}
                    aria-label="Ordina host"
                    value={sort}
                    onValueChange={(value) =>
                      setSort(value as "name" | "recent")
                    }
                    options={[
                      { value: "name", label: "Nome A–Z" },
                      { value: "recent", label: "Ultimo accesso" },
                    ]}
                  />
                  <div
                    className="flex items-center gap-[2px] rounded-[6px] border border-border p-[2px]"
                    role="group"
                    aria-label="Visualizzazione host"
                  >
                    <Button
                      variant="ghost"
                      type="button"
                      className="h-[26px] w-[27px] rounded-[4px] p-0 text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
                      title="Schede"
                      aria-label="Schede"
                      aria-pressed={layout === "cards"}
                      onClick={() => changeLayout("cards")}
                    >
                      <LayoutGrid size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      className="h-[26px] w-[27px] rounded-[4px] p-0 text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
                      title="Lista"
                      aria-label="Lista"
                      aria-pressed={layout === "list"}
                      onClick={() => changeLayout("list")}
                    >
                      <List size={17} />
                    </Button>
                  </div>
                </>
              )}
            </div>
            {usage && page === "hosts" && (
              <div className="mx-[22px] mt-[12px] flex shrink-0 items-center gap-[10px] rounded-[7px] border border-input bg-card px-[10px] py-[6px] text-[12px]">
                Host collegati a: <strong>{usage.label}</strong>
                <Button
                  variant="ghost"
                  type="button"
                  aria-label="Rimuovi filtro identità"
                  className="ml-auto size-[25px] p-0"
                  onClick={() => setUsage(null)}
                >
                  <X size={14} />
                </Button>
              </div>
            )}
            {page === "hosts" && selected.size > 0 && (
              <div
                className="absolute bottom-[20px] left-1/2 z-2 flex w-max max-w-[calc(100%-32px)] animate-[selection-enter_180ms_cubic-bezier(0.16,1,0.3,1)] flex-wrap items-center justify-center gap-[6px] rounded-[12px] border border-input bg-card px-[8px] py-[6px] text-[12px] shadow-[0_8px_28px_#0006] [transform:translateX(-50%)] [&_button]:text-[12px] [&_strong]:mr-auto [&_strong]:font-medium"
                role="toolbar"
                aria-label="Azioni host selezionati"
              >
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    connectHosts(view.hosts.filter((h) => selected.has(h.id)))
                  }
                >
                  <TerminalSquare size={15} />
                  Connetti
                </Button>
                <strong>
                  {selected.size}{" "}
                  {selected.size === 1 ? "selezionato" : "selezionati"}
                </strong>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBulkIdentity("");
                    setBulkOpen(true);
                    setError("");
                  }}
                >
                  <UserRound size={14} />
                  Assegna identità
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setDeletion({
                      kind: "hosts",
                      id: "",
                      ids: [...selected],
                      name: selected.size + " host selezionati",
                    });
                    setError("");
                  }}
                >
                  <Trash2 size={15} />
                  Elimina
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  aria-label="Annulla selezione"
                  disabled={busy}
                  onClick={clearSelection}
                >
                  <X size={15} />
                </Button>
              </div>
            )}
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-auto p-[22px] max-[1100px]:p-[18px]",
                page === "hosts" && selected.size > 0 && "pb-[100px]",
              )}
            >
              {page === "hosts" && group && (
                <div className="mb-[16px] flex items-center justify-start gap-[6px] [&>span]:text-muted-foreground">
                  <Button
                    variant="link"
                    type="button"
                    className="text-[12px]"
                    onClick={() => {
                      setGroup("");
                      clearSelection();
                    }}
                  >
                    <ArrowLeft size={12} />
                    Tutte le cartelle
                  </Button>
                  {ancestry(view.groups, group)
                    .reverse()
                    .map((g) => (
                      <Fragment key={g.id}>
                        <span aria-hidden="true">/</span>
                        <Button
                          variant="link"
                          type="button"
                          className="text-[12px]"
                          aria-current={g.id === group ? "page" : undefined}
                          onClick={() => {
                            setGroup(g.id);
                            clearSelection();
                          }}
                        >
                          {g.name}
                        </Button>
                      </Fragment>
                    ))}
                </div>
              )}
              <div
                className={
                  page === "hosts"
                    ? "hosts-wrap flex w-full min-w-0 flex-[1_0_auto] overflow-visible [&:has(>.empty)>*:not(.empty)]:hidden"
                    : "w-full min-w-0 overflow-auto rounded-[9px] border border-border has-[>.empty]:flex has-[>.empty]:flex-1 has-[>.empty]:border-0 [&:has(>.empty)>table]:hidden"
                }
              >
                {page === "hosts" ? (
                  <HostsView
                    hosts={hostRows}
                    groups={view.groups}
                    hostCount={groupHostCount}
                    group={group}
                    searching={Boolean(query.trim())}
                    onOpenGroup={(id) => {
                      setGroup(id);
                      clearSelection();
                    }}
                    onNewGroup={(parentId) => {
                      setGroupForm(newGroup(parentId));
                      setError("");
                    }}
                    onEditGroup={(g) => {
                      setGroupForm({ ...g });
                      setError("");
                    }}
                    onDeleteGroup={(g) => {
                      setDeletion({ kind: "groups", id: g.id, name: g.name });
                      setError("");
                    }}
                    editingId={hostForm?.id}
                    identities={view.identities}
                    layout={layout}
                    selected={selected}
                    selectedFolders={selectedFolders}
                    onSelectFolders={setSelectedFolders}
                    onSelect={setSelected}
                    onConnect={connect}
                    onEdit={(host) => {
                      setHostForm(editDraft(host));
                      setError("");
                    }}
                    onDuplicate={(host) => {
                      setHostForm({
                        ...editDraft(host),
                        id: crypto.randomUUID(),
                        name: `${host.name} (copia)`,
                        fingerprint: "",
                        os: null,
                        lastConnectedAt: null,
                      });
                      setError("");
                    }}
                    onAssign={(host) => {
                      setSelected(new Set([host.id]));
                      setBulkIdentity(host.identityId);
                      setBulkOpen(true);
                      setError("");
                    }}
                    onDelete={(host) => {
                      setDeletion({
                        kind: "hosts",
                        id: host.id,
                        name: host.name,
                      });
                      setError("");
                    }}
                    onEditIdentity={editIdentity}
                    onError={setError}
                    busy={busy}
                  />
                ) : page === "identities" ? (
                  <IdentitiesTable
                    identities={identityRows}
                    keys={view.keys}
                    busy={busy}
                    onEdit={(id) =>
                      editIdentity(view.identities.find((i) => i.id === id)!)
                    }
                    onDelete={(id, name) => {
                      setDeletion({ kind: "identities", id, name });
                      setError("");
                    }}
                    onUsage={showUsage}
                  />
                ) : (
                  <KeysTable
                    keys={keyRows}
                    identities={view.identities}
                    busy={busy}
                    onEdit={(id) =>
                      editKey(view.keys.find((k) => k.id === id)!)
                    }
                    onDelete={(id, name) => {
                      setDeletion({ kind: "keys", id, name });
                      setError("");
                    }}
                    onUsage={showUsage}
                  />
                )}
                {((page === "hosts" &&
                  !hostRows.length &&
                  !(
                    !query.trim() &&
                    !usage &&
                    childGroups(view.groups, group).length
                  )) ||
                  (page === "identities" && !identityRows.length) ||
                  (page === "keys" && !keyRows.length)) && (
                  <div className="empty flex flex-1 flex-col items-center justify-center px-[24px] pt-[24px] pb-[8vh] text-center text-muted-foreground [&_button]:border [&_button]:border-input [&_h2]:text-foreground [&_p]:mt-[12px] [&_p]:mb-[20px] [&_p]:max-w-[390px] [&_p]:text-[13px] [&_p]:leading-[1.7]">
                    <h2>
                      {query || usage
                        ? "Nessun risultato"
                        : page === "hosts" && group
                          ? "Cartella vuota"
                          : page === "hosts"
                            ? "Nessun host"
                            : page === "identities"
                              ? "Nessuna identità"
                              : "Nessuna chiave SSH"}
                    </h2>
                    <p>
                      {query || usage
                        ? "Modifica la ricerca o rimuovi i filtri."
                        : page === "hosts" && group
                          ? "Aggiungi un host o crea un sottogruppo."
                          : page === "hosts"
                            ? "Crea un’identità e assegnala ai tuoi server."
                            : page === "identities"
                              ? "Crea un’identità con utente SSH e una chiave dal portachiavi, oppure una password."
                              : "Importa la chiave privata una volta, poi selezionala nelle identità."}
                    </p>
                    {query || usage ? (
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setGroup("");
                          setUsage(null);
                          clearSelection();
                          search.current?.focus();
                        }}
                      >
                        Rimuovi filtri
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={busy}
                        onClick={onNew}
                      >
                        <Plus size={14} />
                        {page === "hosts"
                          ? "Aggiungi host"
                          : page === "identities"
                            ? "Crea identità"
                            : "Importa chiave"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        <div
          ref={terminals}
          className={cn(
            "relative min-h-0 flex-1",
            geos.get(active) && "mx-[4px] mb-[4px]",
          )}
          style={{
            display: bar.some((t) => t.id === active) ? "block" : "none",
          }}
        >
          {tabs.map((tab) => {
            const leader = tab.parent ?? tab.id,
              geo = geos.get(leader),
              focus = focusOf(tabs.find((t) => t.id === leader) ?? tab);
            return (
              <TerminalPane
                key={tab.id}
                tab={tab}
                active={active === leader}
                box={
                  tab.id === dragPane
                    ? geo?.panes[tab.id]
                    : (shown.get(leader)?.panes[tab.id] ?? geo?.panes[tab.id])
                }
                ghost={tab.id === dragPane && reflow}
                animate={settling}
                settings={appSettings}
                focused={geo ? focus === tab.id : undefined}
                onFocus={geo ? () => setFocusedPane(tab.id) : undefined}
                onDragPane={
                  geo ? (on) => setDragPane(on ? tab.id : undefined) : undefined
                }
                onError={setError}
                onStatus={tabStatus}
                onTitle={tabTitle}
                onMetadata={vault.refresh}
                onClose={() => askClosePane(tab.id)}
                onRetry={() => {
                  if (geo) return reconnectPane(tab.id);
                  closePane(tab.id);
                  if (tab.kind === "ssh") {
                    const host = view.hosts.find((h) => h.id === tab.host.id);
                    if (host) connect(host);
                  } else if (tab.kind === "local") openLocal();
                  else openQuick(tab.target);
                }}
                onEdit={
                  tab.kind === "ssh"
                    ? () => {
                        const host = view.hosts.find(
                          (h) => h.id === tab.host.id,
                        );
                        if (host) {
                          setActive("vault");
                          setHostForm(editDraft(host));
                        }
                      }
                    : undefined
                }
              />
            );
          })}
          {dragging &&
            Object.entries(
              shown.get(active)?.panes ?? {
                [active]: { x: 0, y: 0, w: 1, h: 1 },
              },
            ).map(([id, box]) =>
              id === dragPane ? null : (
                <div
                  key={id}
                  className="absolute z-3"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.w * 100}%`,
                    height: `${box.h * 100}%`,
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const r = e.currentTarget.getBoundingClientRect(),
                      edge = dropEdge(
                        e.clientX - r.left,
                        e.clientY - r.top,
                        r.width,
                        r.height,
                      );
                    setDropHint((h) =>
                      h?.paneId === id && h.edge === edge
                        ? h
                        : { paneId: id, edge },
                    );
                  }}
                  onDragLeave={() => setDropHint(undefined)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dropHint?.paneId === id && dropHint.edge)
                      dropOn(id, dropHint.edge);
                    clearDnd();
                  }}
                >
                  {dropHint?.paneId === id && dropHint.edge && (
                    <div
                      className={cn(
                        "pointer-events-none absolute rounded-[8px] border-2 border-primary bg-[color-mix(in_oklab,var(--primary)_22%,transparent)]",
                        dropPreviewEdge[dropHint.edge],
                      )}
                    />
                  )}
                </div>
              ),
            )}
          {shown.get(active)?.dividers.map((d) => (
            <div
              key={d.path}
              className={cn(
                // A wide invisible hit area; on hover a small grip appears in the gap.
                "absolute z-2 after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-foreground/70 after:opacity-0 after:transition-opacity after:duration-150 after:content-[''] hover:after:opacity-100 active:after:opacity-100 active:after:bg-primary",
                d.dir === "row"
                  ? "-ml-[6px] w-[12px] cursor-col-resize after:h-[44px] after:w-[4px]"
                  : "-mt-[6px] h-[12px] cursor-row-resize after:h-[4px] after:w-[44px]",
              )}
              style={
                d.dir === "row"
                  ? {
                      left: `${d.at * 100}%`,
                      top: `${d.box.y * 100}%`,
                      height: `${d.box.h * 100}%`,
                    }
                  : {
                      top: `${d.at * 100}%`,
                      left: `${d.box.x * 100}%`,
                      width: `${d.box.w * 100}%`,
                    }
              }
              onPointerDown={(e) =>
                e.currentTarget.setPointerCapture(e.pointerId)
              }
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                const r = terminals.current!.getBoundingClientRect(),
                  row = d.dir === "row",
                  pos = row
                    ? (e.clientX - r.left) / r.width
                    : (e.clientY - r.top) / r.height,
                  ratio =
                    (pos - (row ? d.box.x : d.box.y)) /
                    (row ? d.box.w : d.box.h);
                resizeActive(d.path, ratio);
              }}
            />
          ))}
        </div>
      </main>
      {hostForm && !identityForm && !keyForm && !groupForm && (
        <HostEditor
          value={hostForm}
          onChange={setHostForm}
          view={view}
          busy={busy}
          error={hostAutosave.error || error}
          saveStatus={hostAutosave.status}
          hasUnsavedChanges={hostAutosave.dirty}
          onRetrySave={() => void hostAutosave.flush().catch(() => {})}
          onRevealPassword={() =>
            invokeScoped<string>("reveal_host_password", { id: hostForm.id })
          }
          onClose={() => {
            if (
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
          }}
          onNewGroup={(name) => {
            setGroupForm({ ...newGroup("", name), returnTo: "host" });
            setError("");
          }}
          onNewIdentity={() => {
            setIdentityForm(newIdentity());
            setError("");
          }}
          onSubmit={() => {
            let saved: Host | null = null;
            void run(async () => {
              saved = await hostAutosave.flush();
              if (saved) setHostForm(null);
            }).then(() => {
              if (saved) connect(saved);
            });
          }}
        />
      )}
      {groupForm && (
        <GroupEditor
          value={groupForm}
          onChange={setGroupForm}
          view={view}
          busy={busy}
          error={error}
          returnTo={groupForm.returnTo}
          onClose={closeGroupEditor}
          onSubmit={() =>
            void run(async () => {
              const { returnTo, ...group } = groupForm;
              update(await invokeScoped<View>("save_group", { group }));
              if (returnTo && hostForm)
                setHostForm({
                  ...hostForm,
                  groupId: group.id,
                  inheritIdentity:
                    hostForm.identityId || hostForm.credentials?.username
                      ? hostForm.inheritIdentity
                      : !!group.identityId,
                });
              closeGroupEditor();
              setNotice("Gruppo salvato");
            })
          }
        />
      )}
      {identityForm && !keyForm && (
        <IdentityEditor
          value={identityForm}
          onChange={setIdentityForm}
          view={view}
          busy={busy}
          error={error}
          returnTo={hostForm ? "host" : undefined}
          onClose={closeIdentityEditor}
          onNewKey={() => {
            setKeyForm(newKey());
            setError("");
          }}
          onSubmit={() =>
            void run(async () => {
              update(
                await invokeScoped<View>("save_identity", {
                  identity: identityForm,
                }),
              );
              if (hostForm)
                setHostForm({ ...hostForm, identityId: identityForm.id });
              closeIdentityEditor();
              setNotice("Identità salvata");
            })
          }
        />
      )}
      {keyForm && (
        <KeyEditor
          value={keyForm}
          onChange={setKeyForm}
          view={view}
          busy={busy}
          error={error}
          returnTo={identityForm ? "identità" : undefined}
          onClose={closeKeyEditor}
          onSubmit={() =>
            void run(async () => {
              update(await invokeScoped<View>("save_key", { key: keyForm }));
              if (identityForm)
                setIdentityForm({ ...identityForm, keyId: keyForm.id });
              closeKeyEditor();
              setNotice("Chiave salvata nel portachiavi");
            })
          }
        />
      )}
      {bulkOpen && (
        <Panel
          variant="dialog"
          title="Assegna identità"
          busy={busy}
          error={error}
          onClose={() => {
            setBulkOpen(false);
            setError("");
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
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
            }}
          >
            <p className={muted}>
              Modifica l’identità di {selected.size} host selezionati. Le
              sessioni già aperte restano attive.
            </p>
            <HostSummary
              hosts={view.hosts.filter((host) => selected.has(host.id))}
              identities={view.identities}
            />
            <label>
              Identità
              <SelectField
                aria-label="Identità da assegnare"
                autoFocus
                required
                value={bulkIdentity}
                onValueChange={setBulkIdentity}
                placeholder="Seleziona un’identità"
                options={view.identities.map((i) => ({
                  value: i.id,
                  label: i.name + " — " + i.username,
                }))}
              />
            </label>
            <footer>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setBulkOpen(false)}
                disabled={busy}
              >
                Annulla
              </Button>
              <Button
                variant="default"
                type="submit"
                className="primary"
                disabled={busy || !bulkIdentity}
              >
                Assegna a {selected.size} host
              </Button>
            </footer>
          </form>
        </Panel>
      )}
      {deletion && (
        <Panel
          variant="alert"
          title={
            deletion.kind === "hosts"
              ? "Elimina host"
              : deletion.kind === "identities"
                ? "Elimina identità"
                : deletion.kind === "groups"
                  ? "Elimina gruppo"
                  : "Elimina chiave"
          }
          busy={busy}
          error={error}
          onClose={() => {
            setDeletion(null);
            setError("");
          }}
        >
          <AlertDialogDescription>
            Eliminare <strong>{deletion.name}</strong> dal vault?
          </AlertDialogDescription>
          <p className={help}>
            {deletion.kind === "hosts"
              ? "La chiave e l’identità associate verranno conservate. Il server remoto non viene modificato."
              : deletion.kind === "groups"
                ? "Il gruppo deve essere vuoto: gli host e i sottogruppi non vengono eliminati."
                : "L’elemento verrà rimosso dal vault e dai dispositivi sincronizzati."}
          </p>
          {deletion.kind === "hosts" && (
            <HostSummary
              hosts={view.hosts.filter((host) =>
                (deletion.ids ?? [deletion.id]).includes(host.id),
              )}
              identities={view.identities}
            />
          )}
          <footer>
            <Button
              variant="destructive"
              type="button"
              className="danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
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
                  if (deletion.kind === "groups" && deletion.id === group)
                    setGroup("");
                  setDeletion(null);
                  setNotice(
                    deletion.ids
                      ? "Host selezionati eliminati"
                      : "Elemento eliminato",
                  );
                })
              }
            >
              Elimina
            </Button>
          </footer>
        </Panel>
      )}
      {settings.section && (
        <SettingsDialog
          section={settings.section}
          onSection={settings.changeSection}
          onClose={settings.close}
          error={error}
          busy={busy}
          settings={appSettings}
          onSettings={saveSettings}
          bindings={bindings}
          overrides={overrides}
          onOverrides={saveOverrides}
          mac={mac}
          vault={
            <VaultSettings
              view={view}
              busy={busy}
              syncUrl={settings.syncUrl}
              syncToken={settings.syncToken}
              syncing={syncState === "syncing"}
              lastSync={lastSync}
              onSyncUrl={settings.setSyncUrl}
              onSyncToken={settings.setSyncToken}
              onSaveSync={settings.saveSync}
              remembered={settings.remembered}
              onRemember={settings.remember}
              onSyncNow={() => void synchronize(true)}
              onSwitch={requestSwitch}
              onCreate={session.openCreateDialog}
              onRename={session.openRenameDialog}
              onDelete={session.deleteVault}
            />
          }
        />
      )}
      {savingWs && (
        <Panel
          variant="dialog"
          title={savingWs.hostIds ? "Crea workspace" : "Salva come workspace"}
          busy={busy}
          error={error}
          onClose={() => setSavingWs(null)}
        >
          <p className={help}>
            {savingWs.hostIds
              ? `${savingWs.hostIds.length} host in griglia: lo salvo e lo apro, poi puoi sistemare i pannelli trascinandoli.`
              : "Salva gli host e la disposizione dei pannelli: potrai riaprirli insieme da una nuova scheda."}
          </p>
          {skippedQuick > 0 && (
            <p className={help}>
              {skippedQuick === 1
                ? "1 connessione rapida non verrà salvata: salvala prima come host per includerla."
                : `${skippedQuick} connessioni rapide non verranno salvate: salvale prima come host per includerle.`}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (savingWs.name.trim()) saveWorkspace();
            }}
          >
            <label>
              Nome
              <Input
                autoFocus
                maxLength={80}
                value={savingWs.name}
                onChange={(e) =>
                  setSavingWs({ ...savingWs, name: e.target.value })
                }
              />
            </label>
            <footer>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSavingWs(null)}
              >
                Annulla
              </Button>
              <Button
                variant="default"
                type="submit"
                className="primary"
                disabled={busy || !savingWs.name.trim()}
              >
                Salva
              </Button>
            </footer>
          </form>
        </Panel>
      )}
      {trust && (
        <Panel
          variant="dialog"
          title="Verifica identità del server"
          busy={busy}
          error={error}
          onClose={() => {
            rejectTrust();
            setError("");
          }}
        >
          <p>
            Primo accesso a{" "}
            <strong>
              {trust.host?.address ?? trust.quick?.address}:
              {trust.host?.port ?? trust.quick?.port}
            </strong>
            .
          </p>
          <p className={help}>
            Confronta questa impronta con quella fornita dall’amministratore o
            dalla console del server prima di inviare le credenziali.
          </p>
          <code className={fingerprint}>{trust.fingerprint}</code>
          <footer>
            <Button
              autoFocus
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={rejectTrust}
            >
              Annulla
            </Button>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={approveTrust}
            >
              Impronta verificata, connetti
            </Button>
          </footer>
        </Panel>
      )}
      {vaultPanels}
    </div>
  );
}
if (isTauri() && /Mac/.test(navigator.userAgent))
  document.documentElement.classList.add("mac");
trackOpener();
createRoot(document.getElementById("root")!).render(<App />);
