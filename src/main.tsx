import { HostSummary } from "./HostSummary";
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
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
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
  Pencil,
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
import { createPreviewBackend } from "./preview";
import { WindowControls } from "./WindowControls";
import { TerminalPane, terminalHandles } from "./TerminalPane";
import { SettingsDialog, type SettingsSection } from "./SettingsDialog";
import { VaultSettings } from "./VaultSettings";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_SETTINGS,
  clampFontSize,
  parseSettings,
  type AppSettings,
} from "./settings.mjs";
import { useCloseGuard } from "./CloseGuard";
import {
  actionFor,
  hint as shortcutHint,
  parseOverrides,
  resolve,
  type Combo,
} from "./shortcuts.mjs";
import { OsIcon } from "./OsIcon";
import { HostEditor, IdentityEditor, KeyEditor, Panel } from "./Editors";
import { HostsView } from "./HostsView";
import { VaultPicker } from "./VaultPicker";
import { ActionMenu } from "./ActionMenu";
import { ConnectionLauncher } from "./ConnectionLauncher";
import type { QuickConnection } from "./ConnectionLauncher";
import type { Edge } from "./workbench-state.mjs";
import {
  dropEdge,
  fromTemplate,
  gridLayout,
  insertLeaf,
  layoutRects,
  leafIds,
  pruneTemplate,
  removeLeaf,
  replaceLeaf,
  reorderTabs,
  setRatio,
  snapshotSession,
  syncUrlForVault,
  toTemplate,
} from "./workbench-state.mjs";
import { emptyView, newGroup, newHost, newIdentity, newKey } from "./types";
import type {
  Host,
  HostDraft,
  Identity,
  IdentityForm,
  KeyForm,
  SshKey,
  TerminalTab,
  View,
  QuickTarget,
  GroupForm,
  Workspace,
  WorkspaceDraft,
} from "./types";
import type { SavedNode } from "./workbench-state.mjs";
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
const desktop = isTauri();
const mac = /Mac/i.test(navigator.platform);
type Page = "hosts" | "identities" | "keys";
const labels: Record<Page, string> = {
  hosts: "Host",
  identities: "Identità",
  keys: "Chiavi SSH",
};
function App() {
  const [view, setView] = useState<View>(emptyView),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [restore, setRestore] = useState(false),
    [syncUrl, setSyncUrl] = useState(""),
    [syncToken, setSyncToken] = useState("");
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
  const [settingsSection, setSettingsSection] =
      useState<SettingsSection | null>(null),
    [trust, setTrust] = useState<{
      host?: Host;
      quick?: QuickConnection;
      workspaces?: WorkspaceDraft[];
      activeIndex?: number;
      fingerprint: string;
      tabId?: string;
    } | null>(null),
    [deletion, setDeletion] = useState<{
      kind: Page | "groups";
      id: string;
      name: string;
      ids?: string[];
    } | null>(null);
  const [tabs, setTabs] = useState<TerminalTab[]>([]),
    [drag, setDrag] = useState<{
      id: string;
      over?: string;
      after?: boolean;
    }>(),
    [focusedPane, setFocusedPane] = useState(""),
    [renaming, setRenaming] = useState<string>(),
    [launcherOpen, setLauncherOpen] = useState(false),
    [savingWs, setSavingWs] = useState<{
      tabId?: string;
      hostIds?: string[];
      name: string;
    } | null>(null),
    [dragPane, setDragPane] = useState<string>(),
    // While a pane is dragged, the others close ranks after a short delay, as if it had left.
    [reflow, setReflow] = useState(false),
    [settling, setSettling] = useState(false),
    [dropHint, setDropHint] = useState<{ paneId: string; edge: Edge | null }>(),
    [active, setActive] = useState("vault"),
    [lastSync, setLastSync] = useState(""),
    [preview, setPreview] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">(
    "idle",
  );
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem("shellnest.settings");
      if (stored) return parseSettings(stored);
      // Before the settings dialog the zoom shortcuts kept the size on its own.
      const legacy = Number(localStorage.getItem("shellnest.fontSize"));
      return legacy
        ? { ...DEFAULT_SETTINGS, fontSize: clampFontSize(legacy) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  // Creating, switching or locking leaves the unlock screen; settings must not reappear on the next unlock.
  useEffect(() => {
    if (!view.unlocked) setSettingsSection(null);
  }, [view.unlocked]);
  const openSettings = (section: SettingsSection = "vault") => {
    setSyncUrl(view.syncUrl);
    setError("");
    setSettingsSection(section);
  };
  const saveSettings = (next: AppSettings) => {
    setAppSettings(next);
    try {
      localStorage.setItem("shellnest.settings", JSON.stringify(next));
    } catch {}
  };
  const [overrides, setOverrides] = useState<Record<string, Combo[]>>(() => {
    try {
      return parseOverrides(localStorage.getItem("shellnest.shortcuts") ?? "");
    } catch {
      return {};
    }
  });
  const bindings = useMemo(() => resolve(overrides), [overrides]);
  const hint = (id: string) => shortcutHint(id, mac, bindings);
  const saveOverrides = (next: Record<string, Combo[]>) => {
    setOverrides(next);
    try {
      localStorage.setItem("shellnest.shortcuts", JSON.stringify(next));
    } catch {}
  };
  const closedTabs = useRef<TerminalTab[]>([]);
  const [usage, setUsage] = useState<{ ids: string[]; label: string } | null>(
    null,
  );
  const busyRef = useRef(false),
    panelOpen = useRef(false),
    syncing = useRef(false),
    epoch = useRef(0),
    search = useRef<HTMLInputElement>(null);
  const currentVault = useRef(view.vaultId);
  currentVault.current = view.vaultId;
  const connectionQueue = useRef<Host[]>([]);
  const pendingVerification = useRef(new Set<string>());
  const [layout, setLayout] = useState<"list" | "cards">("cards");
  const [sort, setSort] = useState<"name" | "recent">("name");
  const [launcherKey, setLauncherKey] = useState(0);
  const [vaultDialog, setVaultDialog] = useState<{
    mode: "create" | "rename";
    name: string;
  } | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<string[] | null>(null);
  const closeGuard = useCloseGuard();
  const [pendingLock, setPendingLock] = useState(false);
  const previewBackend = useRef<ReturnType<typeof createPreviewBackend> | null>(
    null,
  );
  const invokeCommand = <T,>(
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    if (desktop) return invoke<T>(command, args);
    if (previewBackend.current) return previewBackend.current<T>(command, args);
    return Promise.reject(new Error("Avvia prima l'anteprima."));
  };
  const invokeScoped = <T,>(
    command: string,
    args: Record<string, unknown> = {},
  ) => invokeCommand<T>(command, { ...args, vaultId: view.vaultId });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        `server-manager.layout.${view.vaultId}`,
      );
      setLayout(saved === "list" ? "list" : "cards");
    } catch {
      setLayout("cards");
    }
  }, [view.vaultId]);
  const changeLayout = (value: "cards" | "list") => {
    setLayout(value);
    try {
      localStorage.setItem(`server-manager.layout.${view.vaultId}`, value);
    } catch {
      /* Preference storage is optional. */
    }
  };
  const update = (next: View) => {
    if (
      !Array.isArray(next.keys) ||
      !Array.isArray(next.identities) ||
      !Array.isArray(next.workspaces) ||
      !Array.isArray(next.vaults) ||
      !next.vaultId
    )
      throw new Error(
        "La versione desktop aperta usa ancora il vecchio modello. Chiudi e riavvia l’app aggiornata.",
      );
    setView(next);
    setSelected(
      (old) =>
        new Set([...old].filter((id) => next.hosts.some((h) => h.id === id))),
    );
  };
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (desktop)
      void invoke<View>("status")
        .then(update)
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const synchronize = async (manual = false) => {
    if (
      !manual &&
      panelOpen.current &&
      (!hostForm ||
        !hostDraftIsValid(
          hostForm,
          view.identities,
          view.hosts.find((h) => h.id === hostForm.id),
          view.groups,
        ))
    )
      return;
    if (syncing.current || busyRef.current) return;
    syncing.current = true;
    if (manual) {
      busyRef.current = true;
      setBusy(true);
    }
    setSyncState("syncing");
    const generation = epoch.current;
    try {
      const next = await invokeScoped<View>("sync_vault");
      if (generation !== epoch.current) return;
      update(next);
      setSyncState("idle");
      setLastSync(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      if (manual) setNotice("Vault sincronizzato");
    } catch (e) {
      if (generation === epoch.current) {
        setSyncState("error");
        setError(String(e));
      }
    } finally {
      syncing.current = false;
      if (manual) {
        busyRef.current = false;
        setBusy(false);
      }
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
  useEffect(() => {
    if (
      !desktop ||
      !view.unlocked ||
      !view.syncConfigured ||
      !view.dirty ||
      hostAutosave.status !== "saved" ||
      busy
    )
      return;
    const timer = setTimeout(() => void synchronize(), 400);
    return () => clearTimeout(timer);
  }, [
    hostAutosave.status,
    view.dirty,
    view.syncConfigured,
    view.vaultId,
    busy,
  ]);
  useEffect(() => {
    if (!desktop || !view.unlocked || !view.syncConfigured) return;
    const timer = setInterval(() => void synchronize(), 30000);
    return () => clearInterval(timer);
  }, [view.unlocked, view.syncConfigured, view.vaultId]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        !view.unlocked ||
        busyRef.current ||
        hostForm ||
        identityForm ||
        keyForm ||
        settingsSection ||
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
        if (leader && to) setTabs((old) => reorderTabs(old, leader.id, to.id));
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
        lockVault: () => {
          if (tabs.length) setPendingLock(true);
          else lockVault();
        },
        openSettings: () => openSettings(),
        closePane: () => leader && askClosePane(focusOf(leader)),
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
    settingsSection,
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
    if (!desktop || !view.unlocked || !tabs.length) return;
    try {
      const snapshot = snapshotSession(tabs, active);
      if (snapshot.items.length)
        localStorage.setItem(
          `shellnest.session.${view.vaultId}`,
          JSON.stringify(snapshot),
        );
    } catch {
      // Restoring a session is a convenience; storage may be unavailable.
    }
  }, [tabs, active, view.vaultId, view.unlocked]);
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
  type Dir = "row" | "col";
  const terminals = useRef<HTMLDivElement>(null);
  const addTab = (tab: TerminalTab) => {
    if (active === "launcher") setLauncherOpen(false);
    setTabs((old) => [...old, tab]);
    setActive(tab.id);
  };
  const spring = useRef<{ id: string; timer: number } | undefined>(undefined);
  const clearSpring = () => {
    window.clearTimeout(spring.current?.timer);
    spring.current = undefined;
  };
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
  const clearDnd = () => {
    clearSpring();
    setDrag(undefined);
    setDragPane(undefined);
    setDropHint(undefined);
  };
  const focusOf = (leader: TerminalTab) =>
    leader.layout && leafIds(leader.layout).includes(focusedPane)
      ? focusedPane
      : leader.id;
  // Shortcut: clone the focused pane's session beside it.
  const splitTab = (leaderId: string, dir: Dir) => {
    const leader = tabs.find((t) => t.id === leaderId);
    if (!leader) return;
    const paneId = focusOf(leader),
      src = tabs.find((t) => t.id === paneId) ?? leader,
      host =
        src.kind === "ssh"
          ? view.hosts.find((h) => h.id === src.host.id)
          : null;
    if (src.kind === "ssh" && !host?.fingerprint) return;
    const clone: TerminalTab = {
      ...src,
      id: crypto.randomUUID(),
      error: undefined,
      status: "connecting",
      parent: leaderId,
      layout: undefined,
    };
    if (clone.kind === "ssh" && host) clone.host = host;
    const edge = dir === "row" ? "right" : "bottom";
    setTabs((old) => [
      ...old.map((t) =>
        t.id === leaderId
          ? {
              ...t,
              layout: insertLeaf(
                t.layout ?? { id: paneId },
                paneId,
                { id: clone.id },
                edge,
              ),
            }
          : t,
      ),
      clone,
    ]);
    setFocusedPane(clone.id);
  };
  // Drop on a pane edge of the active workspace: a tab's sessions join it, or a pane is rearranged.
  const dropOnPane = (targetId: string, edge: Edge) => {
    const leader = tabs.find((t) => t.id === active);
    const srcId = dragPane ?? drag?.id;
    if (
      !leader ||
      !srcId ||
      srcId === targetId ||
      (srcId === leader.id && !dragPane)
    )
      return;
    if (dragPane) {
      const rest = leader.layout && removeLeaf(leader.layout, dragPane);
      if (!rest) return;
      const layout = insertLeaf(rest, targetId, { id: dragPane }, edge);
      setTabs((old) =>
        old.map((t) => (t.id === leader.id ? { ...t, layout } : t)),
      );
    } else {
      const src = tabs.find((t) => t.id === srcId);
      if (!src) return;
      const node = src.layout ?? { id: src.id },
        ids = leafIds(node),
        layout = insertLeaf(
          leader.layout ?? { id: leader.id },
          targetId,
          node,
          edge,
        );
      setTabs((old) =>
        old.map((t) =>
          t.id === leader.id
            ? { ...t, layout }
            : t.id === src.id
              ? { ...t, layout: undefined, parent: leader.id }
              : ids.includes(t.id)
                ? { ...t, parent: leader.id }
                : t,
        ),
      );
    }
    setFocusedPane(srcId);
  };
  const makeTab = (host: Host, id: string = crypto.randomUUID()) => {
    const i = identity(host);
    if (!i && !(host.username && host.hasPassword))
      throw new Error(
        "Inserisci le credenziali dell’host o scegli un’identità.",
      );
    return {
      id,
      kind: "ssh" as const,
      host,
      vaultId: view.vaultId,
      title: host.name,
      status: "connecting" as const,
      username: i?.username ?? host.username!,
      identityName: i?.name ?? "Credenziali dell’host",
    };
  };
  const openTab = (host: Host) => {
    const tab = makeTab(host);
    addTab(tab);
    return tab.id;
  };
  const continueConnections = async () => {
    let pendingTab: string | undefined;
    try {
      while (connectionQueue.current.length) {
        const host = connectionQueue.current[0];
        const tabId = openTab(host);
        if (!host.fingerprint) {
          pendingTab = tabId;
          pendingVerification.current.add(tabId);
          const fingerprint = await invokeScoped<string>("probe_host", {
            id: host.id,
          });
          if (!pendingVerification.current.has(tabId)) return;
          setTrust({ host, fingerprint, tabId });
          return;
        }
        connectionQueue.current.shift();
      }
    } catch (e) {
      connectionQueue.current = [];
      if (pendingTab) {
        if (!pendingVerification.current.delete(pendingTab)) return;
        setTabs((old) =>
          old.map((tab) =>
            tab.id === pendingTab
              ? { ...tab, status: "failed", error: String(e) }
              : tab,
          ),
        );
      }
      throw e;
    }
  };
  const connectHosts = (hosts: Host[]) =>
    void run(async () => {
      if (
        hosts.some(
          (host) => !identity(host) && !(host.username && host.hasPassword),
        )
      )
        throw new Error("Completa le credenziali degli host selezionati.");
      connectionQueue.current = [...hosts];
      await continueConnections();
    });
  const connect = (host: Host) => connectHosts([host]);
  const rememberClosed = (ids: string[]) =>
    closedTabs.current.push(
      ...tabs
        .filter((t) => ids.includes(t.id))
        .map(({ parent, layout, ...t }) => t as TerminalTab),
    );
  const reopenTab = () => {
    const tab = closedTabs.current.pop();
    if (!tab) return;
    if (tab.kind === "ssh") connect(tab.host);
    else if (tab.kind === "quick") {
      try {
        openQuick(tab.target);
      } catch (e) {
        setError(String(e));
      }
    } else openLocal();
  };
  const closeTab = (id: string) => {
    if (pendingVerification.current.delete(id)) connectionQueue.current = [];
    const gone = tabs.find((t) => t.id === id)?.layout;
    const ids = gone ? leafIds(gone) : [id];
    rememberClosed(ids);
    setTabs((t) => t.filter((t) => !ids.includes(t.id)));
    if (active === id) {
      const bar = tabs.filter((t) => !t.parent),
        index = bar.findIndex((t) => t.id === id);
      setActive(bar[index + 1]?.id ?? bar[index - 1]?.id ?? "vault");
    }
  };
  // Takes a pane out of its workspace (keep: it stays as its own tab). A pane is promoted if the leader goes.
  const unlinkPane = (id: string, keep: boolean) => {
    const tab = tabs.find((t) => t.id === id);
    const leader = tab?.parent ? tabs.find((t) => t.id === tab.parent) : tab;
    const rest = leader?.layout && removeLeaf(leader.layout, id);
    if (!leader || !rest) return null;
    const ids = leafIds(rest),
      next = id === leader.id ? ids[0] : leader.id;
    setTabs((old) =>
      old.flatMap((t) =>
        t.id === id
          ? keep
            ? [{ ...t, parent: undefined, layout: undefined }]
            : []
          : t.id === next
            ? [
                {
                  ...t,
                  name: id === leader.id ? leader.name : t.name,
                  parent: undefined,
                  layout: ids.length > 1 ? rest : undefined,
                },
              ]
            : [ids.includes(t.id) ? { ...t, parent: next } : t],
      ),
    );
    return { leader, next };
  };
  const closePane = (id: string) => {
    const moved = unlinkPane(id, false);
    if (!moved) return closeTab(id);
    rememberClosed([id]);
    pendingVerification.current.delete(id);
    if (active === moved.leader.id) setActive(moved.next);
    setFocusedPane(moved.next);
  };
  const isLive = (ids: string[]) =>
    tabs.some((t) => ids.includes(t.id) && t.status === "connected");
  const askClosePane = (id: string) =>
    closeGuard.ask(isLive([id]), () => closePane(id));
  const askCloseTab = (id: string) => {
    const layout = tabs.find((t) => t.id === id)?.layout;
    closeGuard.ask(isLive(layout ? leafIds(layout) : [id]), () => closeTab(id));
  };
  const detachPane = (id: string) => {
    if (!unlinkPane(id, true)) return;
    setActive(id);
    setFocusedPane(id);
  };
  const closeLauncher = () => {
    setLauncherOpen(false);
    if (active === "launcher") setActive(bar[bar.length - 1]?.id ?? "vault");
  };
  const openLauncher = () => {
    setLauncherOpen(true);
    setActive("launcher");
    setLauncherKey((k) => k + 1);
  };
  const makeLocalTab = (id: string = crypto.randomUUID()): TerminalTab => ({
    id,
    kind: "local",
    vaultId: view.vaultId,
    title: "Terminale locale",
    username: "",
    identityName: "",
    status: "connecting",
  });
  // Recreate every session of the given layouts, one tab bar entry each. Hosts not trusted yet are
  // verified first through the usual fingerprint dialog, which calls this again once approved.
  const openWorkspaces = async (
    list: WorkspaceDraft[],
    hosts: Host[] = view.hosts,
    activeIndex = 0,
  ) => {
    if (!list.length) return;
    const built = list.map((item) => {
      const { layout, leaves } = fromTemplate(item.layout, () =>
        crypto.randomUUID(),
      );
      const specs = leaves.map(({ id, spec }) => ({
        id,
        local: !("hostId" in spec),
        host:
          "hostId" in spec
            ? hosts.find((h) => h.id === spec.hostId)
            : undefined,
      }));
      return { name: item.name, layout, specs };
    });
    const specs = built.flatMap((b) => b.specs);
    if (specs.some((s) => !s.local && !s.host))
      throw new Error("Un host da aprire non esiste più.");
    const untrusted = specs.find((s) => s.host && !s.host.fingerprint);
    if (untrusted?.host) {
      const fingerprint = await invokeScoped<string>("probe_host", {
        id: untrusted.host.id,
      });
      setTrust({
        host: untrusted.host,
        fingerprint,
        workspaces: list,
        activeIndex,
      });
      return;
    }
    const groups = built.map((b) => {
      const [leader, ...rest] = b.specs.map((s) =>
        s.host ? makeTab(s.host, s.id) : makeLocalTab(s.id),
      );
      return { leader, rest, layout: b.layout, name: b.name };
    });
    setTabs((old) => [
      ...old,
      ...groups.flatMap((g) => [
        {
          ...g.leader,
          name: g.name,
          layout: g.rest.length ? g.layout : undefined,
        },
        ...g.rest.map((t) => ({ ...t, parent: g.leader.id })),
      ]),
    ]);
    if (active === "launcher") setLauncherOpen(false);
    const target = groups[Math.min(activeIndex, groups.length - 1)].leader.id;
    setActive(target);
    setFocusedPane(target);
  };
  // The tabs open when the app was last used on this device, minus hosts that no longer exist.
  const lastSession = () => {
    try {
      const raw = localStorage.getItem(`shellnest.session.${view.vaultId}`);
      const saved = raw && JSON.parse(raw);
      if (!saved || !Array.isArray(saved.items)) return null;
      const known = new Set(view.hosts.map((h) => h.id));
      const items = (saved.items as WorkspaceDraft[]).flatMap((item) => {
        const layout = pruneTemplate(
          item.layout,
          (leaf) => !("hostId" in leaf) || known.has(leaf.hostId),
        );
        return layout ? [{ name: item.name, layout }] : [];
      });
      const count = (n: SavedNode): number =>
        "dir" in n ? count(n.a) + count(n.b) : 1;
      return items.length
        ? {
            items,
            active: Number(saved.active) || 0,
            count: items.reduce((sum, i) => sum + count(i.layout), 0),
          }
        : null;
    } catch {
      return null;
    }
  };
  const saveWorkspace = () =>
    void run(async () => {
      if (!savingWs) return;
      let layout: SavedNode | null;
      let leader: TerminalTab | undefined;
      if (savingWs.hostIds) {
        layout = gridLayout(savingWs.hostIds.map((hostId) => ({ hostId })));
      } else {
        leader = tabs.find((t) => t.id === savingWs.tabId);
        if (!leader?.layout) return;
        const byId = new Map(tabs.map((t) => [t.id, t]));
        layout = toTemplate(leader.layout, (id) => {
          const t = byId.get(id);
          return t?.kind === "ssh"
            ? { hostId: t.host.id }
            : t?.kind === "local"
              ? { local: true as const }
              : null;
        });
        if (!layout || !("dir" in layout))
          throw new Error(
            "Servono almeno due sessioni salvabili (host o terminale locale): le connessioni rapide non si salvano.",
          );
      }
      const name = savingWs.name.trim(),
        existing = view.workspaces.find((w) => w.name === name);
      update(
        await invokeScoped<View>("save_workspace", {
          workspace: { id: existing?.id ?? "", name, layout },
        }),
      );
      setSavingWs(null);
      setNotice(`Workspace “${name}” salvato.`);
      if (leader) {
        const id = leader.id;
        setTabs((old) => old.map((t) => (t.id === id ? { ...t, name } : t)));
      } else await openWorkspaces([{ name, layout }]);
    });
  const openLocal = () => {
    if (preview) {
      setError("Il terminale locale funziona nell’app desktop.");
      return;
    }
    addTab(makeLocalTab());
  };
  const openQuick = (target: QuickTarget) => {
    const i = view.identities.find((i) => i.id === target.identityId);
    if (!i) throw new Error("Identità non disponibile");
    const tab: TerminalTab = {
      id: crypto.randomUUID(),
      kind: "quick",
      vaultId: view.vaultId,
      title: target.address,
      username: target.username ?? i.username,
      identityName: i.name,
      target,
      status: "connecting",
    };
    addTab(tab);
  };
  const quickConnect = (target: QuickConnection) =>
    void run(async () => {
      if (preview)
        throw new Error("Le connessioni funzionano nell’app desktop.");
      const fingerprint = await invokeScoped<string>("probe_target", {
        address: target.address,
        port: target.port,
      });
      setTrust({ quick: target, fingerprint });
    });
  // New session in place of `id` (same slot in the tab bar or split layout).
  const reconnectPane = (id: string) => {
    const old = tabs.find((t) => t.id === id);
    if (!old) return;
    const next: TerminalTab = {
      ...old,
      id: crypto.randomUUID(),
      error: undefined,
      status: "connecting",
    };
    if (old.layout) next.layout = replaceLeaf(old.layout, id, next.id);
    if (next.kind === "ssh")
      next.host = view.hosts.find((h) => h.id === next.host.id) ?? next.host;
    setTabs((list) =>
      list.map((t) =>
        t.id === id
          ? next
          : t.parent === id
            ? { ...t, parent: next.id }
            : t.layout && leafIds(t.layout).includes(id)
              ? { ...t, layout: replaceLeaf(t.layout, id, next.id) }
              : t,
      ),
    );
    if (active === id) setActive(next.id);
    if (focusedPane === id) setFocusedPane(next.id);
  };
  // On a split tab both actions apply to its focused pane.
  const duplicateTab = (tab: TerminalTab, reconnect = false) => {
    if (!reconnect && tab.layout) return splitTab(tab.id, "row");
    const target = tabs.find((t) => t.id === focusOf(tab)) ?? tab;
    if (target.kind === "ssh") {
      const host = view.hosts.find((h) => h.id === target.host.id);
      if (reconnect && host?.fingerprint) return reconnectPane(target.id);
      if (reconnect) closePane(target.id);
      if (host) connect(host);
      return;
    }
    if (reconnect) return reconnectPane(target.id);
    addTab({
      ...target,
      error: undefined,
      id: crypto.randomUUID(),
      status: "connecting",
    });
  };
  const metadataUpdated = (vaultId: string) => {
    if (vaultId !== currentVault.current) return;
    void invoke<View>("status")
      .then((next) => {
        if (next.vaultId === currentVault.current) update(next);
      })
      .catch((e) => setError(String(e)));
  };
  const bar = tabs.filter((t) => !t.parent);
  const skippedQuick = (() => {
    const layout = tabs.find((t) => t.id === savingWs?.tabId)?.layout;
    return layout
      ? leafIds(layout).filter(
          (id) => tabs.find((t) => t.id === id)?.kind === "quick",
        ).length
      : 0;
  })();
  useEffect(() => {
    if (dragPane) {
      setSettling(true);
      const timer = window.setTimeout(() => setReflow(true), 150);
      return () => window.clearTimeout(timer);
    }
    setReflow(false);
    const timer = window.setTimeout(() => setSettling(false), 300);
    return () => window.clearTimeout(timer);
  }, [dragPane]);
  const geos = new Map(
    tabs.flatMap((t) =>
      t.layout ? [[t.id, layoutRects(t.layout)] as const] : [],
    ),
  );
  // Geometry on screen: without the dragged pane once the others have closed ranks.
  const shown = new Map(geos);
  if (reflow && dragPane) {
    const leader = tabs.find((t) => t.id === dragPane)?.parent ?? dragPane;
    const layout = tabs.find((t) => t.id === leader)?.layout;
    const rest = layout && removeLeaf(layout, dragPane);
    if (rest) shown.set(leader, layoutRects(rest));
  }
  const tabStatus = (
    id: string,
    status: "connecting" | "connected" | "closed" | "failed",
  ) => setTabs((old) => old.map((t) => (t.id === id ? { ...t, status } : t)));
  const tabTitle = (id: string, termTitle?: string) =>
    setTabs((old) =>
      old.some((t) => t.id === id && t.termTitle !== termTitle)
        ? old.map((t) => (t.id === id ? { ...t, termTitle } : t))
        : old,
    );
  const resetWorkspace = (next: View) => {
    setLauncherOpen(false);
    setSavingWs(null);
    epoch.current++;
    update(next);
    setTabs([]);
    connectionQueue.current = [];
    pendingVerification.current.clear();
    setActive("vault");
    setQuery("");
    setGroup("");
    setUsage(null);
    clearSelection();
    setPassword("");
    setConfirmPassword("");
    setRestore(false);
    setSyncToken("");
    setHostForm(null);
    setIdentityForm(null);
    setKeyForm(null);
    setLastSync("");
    setSyncState("idle");
    setNotice("");
    setPendingSwitch(null);
    setVaultDialog(null);
  };
  const switchVault = (id: string) =>
    void run(async () => {
      epoch.current++;
      resetWorkspace(
        await invokeCommand<View>("select_vault", { vaultId: id }),
      );
    });
  const lockVault = () =>
    void run(async () => {
      epoch.current++;
      resetWorkspace(await invokeScoped<View>("lock"));
      setPendingLock(false);
    });
  const requestSwitch = (id: string) => {
    if (id === view.vaultId) return;
    if (tabs.length) {
      setPendingSwitch(id);
      setError("");
    } else switchVault(id);
  };
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
    settingsSection ||
    trust ||
    deletion ||
    bulkOpen ||
    vaultDialog ||
    pendingSwitch ||
    pendingClose ||
    pendingLock
  );
  panelOpen.current = anyPanel;
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
      onCreate={() => {
        setError("");
        setVaultDialog({ mode: "create", name: "" });
      }}
      onRename={() => {
        setError("");
        setVaultDialog({ mode: "rename", name: view.vaultName });
      }}
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
              void run(async () => {
                if (vaultDialog.mode === "create") {
                  epoch.current++;
                  resetWorkspace(
                    await invokeScoped<View>("create_vault", {
                      name: vaultDialog.name,
                    }),
                  );
                } else {
                  update(
                    await invokeCommand<View>("rename_vault", {
                      vaultId: view.vaultId,
                      name: vaultDialog.name,
                    }),
                  );
                  setVaultDialog(null);
                }
              });
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
              onClick={() => switchVault(pendingSwitch)}
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
              onClick={() => {
                setTabs((old) =>
                  old.filter((t) => !pendingClose.includes(t.id)),
                );
                setPendingClose(null);
              }}
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
  if (loading)
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
              : restore
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
                : restore
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
                void run(async () => {
                  if (!view.exists && !restore && password !== confirmPassword)
                    throw new Error("Le password non coincidono.");
                  const next = restore
                    ? await invokeScoped<View>("restore_vault", {
                        url: syncUrl,
                        token: syncToken,
                        password,
                      })
                    : await invokeScoped<View>("unlock", {
                        password,
                        create: !view.exists,
                      });
                  update(next);
                  setPassword("");
                  setConfirmPassword("");
                  setSyncToken("");
                });
              }}
            >
              {restore && (
                <>
                  <label>
                    URL completo del vault remoto
                    <Input
                      required
                      type="url"
                      value={syncUrl}
                      onChange={(e) => setSyncUrl(e.target.value)}
                      placeholder="https://sync.example.com"
                    />
                  </label>
                  <label>
                    Token
                    <PasswordInput
                      autoComplete="off"
                      required
                      value={syncToken}
                      onChange={(e) => setSyncToken(e.target.value)}
                    />
                  </label>
                </>
              )}
              {restore && (
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
                  minLength={view.exists || restore ? 1 : 12}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {!view.exists && !restore && (
                <label>
                  Conferma password
                  <PasswordInput
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </label>
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
                    : restore
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
                onClick={() =>
                  void run(async () => {
                    previewBackend.current = createPreviewBackend();
                    update(await previewBackend.current<View>("status"));
                    setPreview(true);
                  })
                }
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
              onClick={() => {
                setRestore(!restore);
                setError("");
              }}
              disabled={busy}
            >
              {restore ? "Crea un vault locale" : "Collega un vault esistente"}
            </Button>
          )}
          <p className="mt-[28px] text-[12px] leading-[1.7] text-muted-foreground">
            La sincronizzazione è opzionale. Nessun account necessario per l’uso
            locale.
          </p>
          {(desktop || preview) && !view.exists && !restore && (
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
            <DropdownMenuItem disabled={busy} onClick={() => openSettings()}>
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
            <DropdownMenuItem
              disabled={busy}
              onClick={() => (tabs.length ? setPendingLock(true) : lockVault())}
            >
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
          className="flex min-w-0 flex-1 items-center gap-[4px] overflow-x-auto px-[8px] py-[5px]"
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
          <TabShell fixed selected={active === "vault"}>
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
                e.dataTransfer.setData(
                  "application/x-server-manager-tab",
                  tab.id,
                );
                setDrag({ id: tab.id });
              }}
              onDragEnd={clearDnd}
              onDragOver={(e) => {
                if (
                  !e.dataTransfer.types.includes(
                    "application/x-server-manager-tab",
                  )
                )
                  return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                // Hover a dragged tab over another one to open it, so it can be dropped on its panes.
                if (drag?.id !== tab.id && spring.current?.id !== tab.id) {
                  clearSpring();
                  spring.current = {
                    id: tab.id,
                    timer: window.setTimeout(() => setActive(tab.id), 500),
                  };
                }
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
                  "application/x-server-manager-tab",
                );
                setTabs((old) => reorderTabs(old, moving, tab.id));
                clearDnd();
              }}
            >
              <TabLead
                icon={tabIcon(tab)}
                onClose={() => askCloseTab(tab.id)}
                label={tabLabel(tab)}
                status={tab.status ?? "connecting"}
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
                    setTabs((old) =>
                      old.map((t) =>
                        t.id === tab.id ? { ...t, name: name || undefined } : t,
                      ),
                    );
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
                className="size-[24px]"
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
                    setTabs((old) =>
                      reorderTabs(old, tab.id, bar[index - 1].id),
                    );
                  }}
                >
                  <ArrowLeft size={12} />
                  Sposta a sinistra
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={bar[bar.length - 1].id === tab.id}
                  onClick={() => {
                    const index = bar.findIndex((t) => t.id === tab.id);
                    setTabs((old) =>
                      reorderTabs(old, tab.id, bar[index + 1].id),
                    );
                  }}
                >
                  <ArrowRight size={12} />
                  Sposta a destra
                </DropdownMenuItem>
              </ActionMenu>
            </TabShell>
          ))}
          {launcherOpen && (
            <TabShell selected={active === "launcher"}>
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
              else openSettings("vault");
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
            onActivateTab={(id) => {
              setLauncherOpen(false);
              setActive(id);
            }}
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
                onMetadata={metadataUpdated}
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
          {(dragPane || (drag?.id && drag.id !== active)) &&
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
                      dropOnPane(id, dropHint.edge);
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
                setTabs((old) =>
                  old.map((t) =>
                    t.id === active && t.layout
                      ? { ...t, layout: setRatio(t.layout, d.path, ratio) }
                      : t,
                  ),
                );
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
      {settingsSection && (
        <SettingsDialog
          section={settingsSection}
          onSection={(next) => {
            setError("");
            setSettingsSection(next);
          }}
          onClose={() => {
            setSettingsSection(null);
            setSyncToken("");
            setError("");
          }}
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
              syncUrl={syncUrl}
              syncToken={syncToken}
              syncing={syncState === "syncing"}
              lastSync={lastSync}
              onSyncUrl={setSyncUrl}
              onSyncToken={setSyncToken}
              onSaveSync={() =>
                void run(async () => {
                  update(
                    await invokeScoped<View>("configure_sync", {
                      url: syncUrlForVault(syncUrl, view.vaultId),
                      token: syncToken,
                    }),
                  );
                  setSyncToken("");
                  setNotice("Configurazione salvata");
                })
              }
              onSyncNow={() => void synchronize(true)}
              onSwitch={requestSwitch}
              onCreate={() => {
                setError("");
                setVaultDialog({ mode: "create", name: "" });
              }}
              onRename={() => {
                setError("");
                setVaultDialog({ mode: "rename", name: view.vaultName });
              }}
              onDelete={() =>
                void run(async () => {
                  epoch.current++;
                  setSettingsSection(null);
                  resetWorkspace(await invokeScoped<View>("delete_vault"));
                })
              }
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
            connectionQueue.current = [];
            if (trust.tabId) closeTab(trust.tabId);
            setTrust(null);
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
              onClick={() => {
                connectionQueue.current = [];
                if (trust.tabId) closeTab(trust.tabId);
                setTrust(null);
              }}
            >
              Annulla
            </Button>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (trust.quick) {
                    openQuick({
                      ...trust.quick,
                      expectedFingerprint: trust.fingerprint,
                    });
                  } else if (trust.host) {
                    await invokeScoped("trust_host", {
                      id: trust.host.id,
                      expected: trust.fingerprint,
                      address: trust.host.address,
                      port: trust.host.port,
                    });
                    const next = await invokeScoped<View>("status");
                    update(next);
                    const approved = next.hosts.find(
                      (h) => h.id === trust.host!.id,
                    );
                    if (!approved?.fingerprint)
                      throw new Error("Impronta non salvata.");
                    if (trust.workspaces) {
                      setTrust(null);
                      await openWorkspaces(
                        trust.workspaces,
                        next.hosts,
                        trust.activeIndex,
                      );
                      return;
                    }
                    if (
                      trust.tabId &&
                      pendingVerification.current.delete(trust.tabId)
                    ) {
                      setTabs((tabs) =>
                        tabs.map((tab) =>
                          tab.id === trust.tabId && tab.kind === "ssh"
                            ? { ...tab, host: approved }
                            : tab,
                        ),
                      );
                    }
                    connectionQueue.current.shift();
                  }
                  setTrust(null);
                  await continueConnections();
                })
              }
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
