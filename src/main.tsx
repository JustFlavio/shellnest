import { HostSummary } from "./HostSummary";
import { useHostAutosave } from "./useHostAutosave";
import { hostDraftIsValid } from "./host-draft";
import { AlertDialogDescription } from "./components/ui/alert-dialog";
import { SelectField } from "./SelectField";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "./components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Check,
  Cloud,
  Folder,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
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
  Keyboard,
} from "lucide-react";
import { createPreviewBackend } from "./preview";
import { WindowControls } from "./WindowControls";
import { TerminalPane } from "./TerminalPane";
import { HostEditor, IdentityEditor, KeyEditor, Panel } from "./Editors";
import { HostsView } from "./HostsView";
import { VaultPicker } from "./VaultPicker";
import { ActionMenu } from "./ActionMenu";
import { ConnectionLauncher } from "./ConnectionLauncher";
import type { QuickConnection } from "./ConnectionLauncher";
import { reorderTabs, syncUrlForVault } from "./workbench-state.mjs";
import { emptyView, newHost, newIdentity, newKey } from "./types";
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
} from "./types";
import "./theme.css";
import "./style.css";

if (import.meta.env.MODE === "desktop-e2e") {
  void import("@wdio/tauri-plugin");
}

const desktop = isTauri();
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
  const [settings, setSettings] = useState(false),
    [trust, setTrust] = useState<{
      host?: Host;
      quick?: QuickConnection;
      fingerprint: string;
      tabId?: string;
    } | null>(null),
    [deletion, setDeletion] = useState<{
      kind: Page;
      id: string;
      name: string;
      ids?: string[];
    } | null>(null);
  const [tabs, setTabs] = useState<TerminalTab[]>([]),
    [active, setActive] = useState("vault"),
    [lastSync, setLastSync] = useState(""),
    [preview, setPreview] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">(
    "idle",
  );
  const [shortcuts, setShortcuts] = useState(false);
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
    view.vaultId,
    busy || !!identityForm || !!keyForm,
    async (draft) => {
      const generation = epoch.current;
      const { credentials, username, hasPassword, ...host } = draft;
      const next = await invokeScoped<View>("save_host", {
        host,
        credentials: host.identityId
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
        settings ||
        bulkOpen ||
        deletion ||
        trust ||
        vaultDialog ||
        pendingSwitch ||
        pendingClose ||
        pendingLock ||
        shortcuts
      )
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        ["k", "t"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        e.stopPropagation();
        setActive("launcher");
        setLauncherKey((key) => key + 1);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setActive("vault");
        setHostForm(newHost());
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        setActive("vault");
        requestAnimationFrame(() => search.current?.focus());
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "l"
      ) {
        e.preventDefault();
        if (tabs.length) setPendingLock(true);
        else lockVault();
      }
      if (e.key === "Escape" && active === "vault") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [
    view,
    hostForm,
    identityForm,
    keyForm,
    settings,
    bulkOpen,
    deletion,
    trust,
    active,
    preview,
    vaultDialog,
    pendingSwitch,
    pendingClose,
    pendingLock,
    shortcuts,
  ]);
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
    view.identities.find((i) => i.id === host.identityId);
  const openTab = (host: Host) => {
    const i = identity(host);
    if (!i && !(host.username && host.hasPassword))
      throw new Error(
        "Inserisci le credenziali dell’host o scegli un’identità.",
      );
    const tab = {
      id: crypto.randomUUID(),
      kind: "ssh" as const,
      host,
      vaultId: view.vaultId,
      title: host.name,
      status: "connecting" as const,
      username: i?.username ?? host.username!,
      identityName: i?.name ?? "Credenziali dell’host",
    };
    setTabs((t) => [...t, tab]);
    setActive(tab.id);
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
      if (preview)
        throw new Error("Le connessioni funzionano nell’app desktop.");
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
  const closeTab = (id: string) => {
    if (pendingVerification.current.delete(id)) connectionQueue.current = [];
    setTabs((t) => t.filter((t) => t.id !== id));
    if (active === id) {
      const index = tabs.findIndex((t) => t.id === id);
      setActive(tabs[index + 1]?.id ?? tabs[index - 1]?.id ?? "vault");
    }
  };
  const openLauncher = () => {
    setActive("launcher");
    setLauncherKey((k) => k + 1);
  };
  const openLocal = () => {
    if (preview) {
      setError("Il terminale locale funziona nell’app desktop.");
      return;
    }
    const tab: TerminalTab = {
      id: crypto.randomUUID(),
      kind: "local",
      vaultId: view.vaultId,
      title: "Terminale locale",
      username: "",
      identityName: "",
      status: "connecting",
    };
    setTabs((old) => [...old, tab]);
    setActive(tab.id);
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
    setTabs((old) => [...old, tab]);
    setActive(tab.id);
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
  const duplicateTab = (tab: TerminalTab, reconnect = false) => {
    if (tab.kind === "ssh") {
      const host = view.hosts.find((h) => h.id === tab.host.id);
      if (reconnect) closeTab(tab.id);
      if (host) connect(host);
      return;
    }
    const next = {
      ...tab,
      error: undefined,
      id: crypto.randomUUID(),
      status: "connecting" as const,
    };
    setTabs((old) =>
      reconnect ? old.map((t) => (t.id === tab.id ? next : t)) : [...old, next],
    );
    setActive(next.id);
  };
  const metadataUpdated = (vaultId: string) => {
    if (vaultId !== currentVault.current) return;
    void invoke<View>("status")
      .then((next) => {
        if (next.vaultId === currentVault.current) update(next);
      })
      .catch((e) => setError(String(e)));
  };
  const tabStatus = (
    id: string,
    status: "connecting" | "connected" | "closed" | "failed",
  ) => setTabs((old) => old.map((t) => (t.id === id ? { ...t, status } : t)));
  const resetWorkspace = (next: View) => {
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
  const groups = [
    ...new Set(view.hosts.map((h) => h.group).filter(Boolean)),
  ].sort();
  const hostRows = view.hosts
    .filter(
      (h) =>
        (!group || h.group === group) &&
        (!usage || usage.ids.includes(h.identityId)) &&
        `${h.name} ${h.address} ${h.group} ${identity(h)?.name ?? ""} ${identity(h)?.username ?? h.username ?? ""}`
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
    identityForm ||
    keyForm ||
    settings ||
    trust ||
    deletion ||
    bulkOpen ||
    vaultDialog ||
    pendingSwitch ||
    pendingClose ||
    pendingLock ||
    shortcuts
  );
  panelOpen.current = anyPanel;
  const alert =
    error && !anyPanel ? (
      <div className="error-bar" role="alert">
        <span>{error}</span>
        <Button
          variant="ghost"
          type="button"
          aria-label="Chiudi errore"
          onClick={() => setError("")}
        >
          <X size={16} />
        </Button>
      </div>
    ) : null;
  const onNew = () => {
    setError("");
    if (page === "hosts") setHostForm(newHost());
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
                <p className="help">
                  Il nuovo vault avrà host, identità, chiavi e password
                  principale propri. Dopo la creazione scegli la sua password
                  oppure collega un vault remoto esistente.
                </p>
                {tabs.length > 0 && (
                  <div className="callout">
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
          <div className="callout">
            Verranno chiuse tutte le {tabs.length} sessioni aperte, incluse le
            shell locali. Il vault attuale verrà bloccato.
          </div>
          <footer>
            <Button
              data-alert-cancel
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setPendingSwitch(null)}
            >
              Annulla
            </Button>
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
              data-alert-cancel
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setPendingClose(null)}
            >
              Annulla
            </Button>
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
              data-alert-cancel
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setPendingLock(false)}
            >
              Annulla
            </Button>
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
      <main className="gate">
        <header className="gate-titlebar" data-tauri-drag-region>
          <span data-tauri-drag-region>Server Manager</span>
          <WindowControls onError={setError} />
        </header>
        <p>Apertura vault…</p>
      </main>
    );
  if (!view.unlocked)
    return (
      <main className="gate">
        <header className="gate-titlebar" data-tauri-drag-region>
          <span data-tauri-drag-region>Server Manager</span>
          <WindowControls onError={setError} />
        </header>
        <section className="login">
          <div className="app-name">
            <span className="brand-icon">
              <TerminalSquare size={18} />
            </span>
            Server Manager
            <span>{desktop ? "0.3 · In sviluppo" : "Anteprima browser"}</span>
          </div>
          {(desktop || preview) && vaultPicker}
          <h1>
            {view.exists
              ? "Sblocca vault"
              : restore
                ? "Collega dispositivo"
                : desktop || preview
                  ? "Crea vault locale"
                  : "Esplora Server Manager"}
          </h1>
          <p className="muted">
            {!desktop && !preview
              ? "Client SSH open source per Windows e macOS, con sincronizzazione self-hosted opzionale."
              : view.exists
                ? "Inserisci la password principale."
                : restore
                  ? "Apri il vault già presente nel tuo servizio di sincronizzazione."
                  : "Host, identità e chiavi SSH vengono salvati sul dispositivo, cifrati."}
          </p>
          {preview && (
            <p className="callout">
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
                    <Input
                      type="password"
                      autoComplete="off"
                      required
                      value={syncToken}
                      onChange={(e) => setSyncToken(e.target.value)}
                    />
                  </label>
                </>
              )}
              {restore && (
                <p className="help">
                  Copia l’URL completo dalle impostazioni dell’altro
                  dispositivo, incluso /vaults/… quando presente.
                </p>
              )}
              <label>
                Password principale
                <Input
                  autoFocus
                  type="password"
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
                  <Input
                    type="password"
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
                className="primary full"
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
              <div className="callout">
                Prova gli stessi form e le stesse azioni con dati fittizi in
                memoria. SSH e cifratura richiedono l’app desktop.
              </div>
              <Button
                variant="default"
                type="button"
                className="primary full"
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
              variant="ghost"
              type="button"
              className="link login-link"
              onClick={() => {
                setRestore(!restore);
                setError("");
              }}
              disabled={busy}
            >
              {restore ? "Crea un vault locale" : "Collega un vault esistente"}
            </Button>
          )}
          <p className="login-note">
            La sincronizzazione è opzionale. Nessun account necessario per l’uso
            locale.
          </p>
          {(desktop || preview) && !view.exists && !restore && (
            <p className="help">
              Usa almeno 12 caratteri. La password principale non è
              recuperabile: conservala in un gestore di password.
            </p>
          )}
        </section>
        {vaultPanels}
      </main>
    );
  return (
    <div className="app">
      <header className="app-header" data-tauri-drag-region>
        <div className="app-name" data-tauri-drag-region>
          <span className="brand-icon">
            <TerminalSquare size={18} />
          </span>
          <span className="brand-name" data-tauri-drag-region>
            Server Manager
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="app-menu-trigger"
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
                setHostForm(newHost());
              }}
            >
              <Plus size={15} />
              Nuovo host
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={openLauncher}>
              <Plus size={15} />
              Nuova tab <kbd>Ctrl/Cmd T</kbd>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={openLocal}>
              <TerminalSquare size={15} />
              Terminale locale
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => changeLayout("cards")}>
              Vista a card
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLayout("list")}>
              Vista a lista
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={busy}
              onClick={() => {
                setSyncUrl(view.syncUrl);
                setSettings(true);
                setError("");
              }}
            >
              <Settings2 size={15} />
              Impostazioni
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShortcuts(true)}>
              <Keyboard size={15} />
              Scorciatoie da tastiera
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
          className="tabbar"
          role="navigation"
          aria-label="Sessioni e connessioni"
          data-tauri-drag-region
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={active === tab.id ? "tab selected" : "tab"}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData(
                  "application/x-server-manager-tab",
                  tab.id,
                )
              }
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes(
                    "application/x-server-manager-tab",
                  )
                )
                  e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const moving = e.dataTransfer.getData(
                  "application/x-server-manager-tab",
                );
                setTabs((old) => reorderTabs(old, moving, tab.id));
              }}
            >
              <Button
                variant="ghost"
                type="button"
                aria-current={active === tab.id ? "page" : undefined}
                onClick={() => setActive(tab.id)}
              >
                <TerminalSquare size={14} />
                <span className={`session-dot ${tab.status ?? "connecting"}`} />
                {tab.title}
              </Button>
              <ActionMenu label={`Azioni scheda ${tab.title}`}>
                <DropdownMenuItem onClick={() => duplicateTab(tab)}>
                  Duplica sessione
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateTab(tab, true)}>
                  Riconnetti
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={tabs.length < 2}
                  onClick={() =>
                    setPendingClose(
                      tabs.filter((t) => t.id !== tab.id).map((t) => t.id),
                    )
                  }
                >
                  Chiudi altre sessioni
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={tabs[0].id === tab.id}
                  onClick={() => {
                    const index = tabs.findIndex((t) => t.id === tab.id);
                    setTabs((old) =>
                      reorderTabs(old, tab.id, old[index - 1].id),
                    );
                  }}
                >
                  <ArrowLeft size={12} />
                  Sposta a sinistra
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={tabs[tabs.length - 1].id === tab.id}
                  onClick={() => {
                    const index = tabs.findIndex((t) => t.id === tab.id);
                    setTabs((old) =>
                      reorderTabs(old, tab.id, old[index + 1].id),
                    );
                  }}
                >
                  <ArrowRight size={12} />
                  Sposta a destra
                </DropdownMenuItem>
              </ActionMenu>
              <Button
                variant="ghost"
                type="button"
                aria-label={`Chiudi ${tab.title}`}
                onClick={() => closeTab(tab.id)}
              >
                <X size={13} />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            type="button"
            className="new-tab"
            aria-label="Nuova connessione"
            title="Nuova connessione · Ctrl/Cmd K"
            onClick={openLauncher}
          >
            <Plus size={18} />
          </Button>
          <span className="tab-spacer" data-tauri-drag-region />
          <Button
            variant="ghost"
            type="button"
            className="sync-status"
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
              else {
                setSyncUrl(view.syncUrl);
                setSettings(true);
                setError("");
              }
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
                  : "Locale"}
          </Button>
        </div>
        <WindowControls onError={setError} />
      </header>
      <aside className="sidebar">
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
              <Button
                variant="ghost"
                type="button"
                key={p}
                className={
                  page === p && active === "vault" ? "nav active" : "nav"
                }
                aria-label={labels[p]}
                title={labels[p]}
                aria-current={
                  page === p && active === "vault" ? "page" : undefined
                }
                onClick={() => navigate(p)}
              >
                <Icon size={16} />
                <span className="nav-label">{labels[p]}</span>
                <span className="nav-count">
                  {p === "hosts"
                    ? view.hosts.length
                    : p === "identities"
                      ? view.identities.length
                      : view.keys.length}
                </span>
              </Button>
            );
          })}
        </nav>
        {groups.length > 0 && (
          <nav className="folder-nav" aria-label="Cartelle host">
            <h2>Cartelle</h2>
            {groups.map((name) => (
              <Button
                key={name}
                variant="ghost"
                type="button"
                className={`nav${page === "hosts" && group === name && active === "vault" ? " active" : ""}`}
                aria-label={`Cartella ${name}`}
                aria-current={
                  page === "hosts" && group === name && active === "vault"
                    ? "page"
                    : undefined
                }
                title={name}
                onClick={() => {
                  navigate("hosts");
                  setGroup(name);
                }}
              >
                <Folder size={15} />
                <span className="nav-label">{name}</span>
                <span className="nav-count">
                  {view.hosts.filter((h) => h.group === name).length}
                </span>
              </Button>
            ))}
          </nav>
        )}
      </aside>
      <main className="main">
        {preview && (
          <div className="preview-bar">
            Anteprima interattiva · Usa dati fittizi · Modifiche azzerate al
            ricaricamento
          </div>
        )}
        {alert}
        {notice && (
          <div className="notice" role="status">
            <Check size={14} />
            {notice}
          </div>
        )}
        {active === "launcher" && (
          <ConnectionLauncher
            key={`${view.vaultId}-${launcherKey}`}
            hosts={view.hosts}
            identities={view.identities}
            tabs={tabs.map((t) => ({
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
            onActivateTab={setActive}
            onLocalTerminal={openLocal}
            onQuickConnect={quickConnect}
            preview={preview}
            busy={busy}
          />
        )}
        {active === "vault" && (
          <section className="workspace">
            <header className="page-heading">
              <div className="page-title">
                <h1>{page === "hosts" && group ? group : labels[page]}</h1>
                <span className="result-count" role="status">
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
                  title="Ctrl/Cmd K"
                >
                  <TerminalSquare size={15} />
                  Connessione rapida
                </Button>
              )}
            </header>
            <div className="workspace-search">
              <div className="search">
                <Search size={16} />
                <Input
                  ref={search}
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
            <div className="toolbar">
              <Button
                variant="default"
                type="button"
                className="primary"
                disabled={busy}
                onClick={onNew}
              >
                <Plus size={15} />
                {page === "hosts"
                  ? "Nuovo host"
                  : page === "identities"
                    ? "Nuova identità"
                    : "Importa chiave"}
              </Button>
              {page === "hosts" && (
                <Button
                  variant="ghost"
                  type="button"
                  className="local-terminal-button"
                  disabled={busy || preview}
                  onClick={openLocal}
                >
                  <TerminalSquare size={16} />
                  Terminale locale
                </Button>
              )}
              <span className="toolbar-spacer" />
              {page === "hosts" && (
                <>
                  <SelectField
                    className="folder-filter"
                    aria-label="Filtra per cartella"
                    placeholder="Tutte le cartelle"
                    value={group}
                    onValueChange={(value) => {
                      setGroup(value);
                      clearSelection();
                    }}
                    options={[
                      { value: "", label: "Tutte le cartelle" },
                      ...groups.map((name) => ({ value: name, label: name })),
                    ]}
                  />
                  <SelectField
                    className="sort-select"
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
                    className="view-toggle"
                    role="group"
                    aria-label="Visualizzazione host"
                  >
                    <Button
                      variant="ghost"
                      type="button"
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
              <div className="filter-bar">
                Host collegati a: <strong>{usage.label}</strong>
                <Button
                  variant="ghost"
                  type="button"
                  aria-label="Rimuovi filtro identità"
                  onClick={() => setUsage(null)}
                >
                  <X size={14} />
                </Button>
              </div>
            )}
            {page === "hosts" && selected.size > 0 && (
              <div
                className="selection-bar"
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
                  variant="ghost"
                  disabled={busy}
                  className="danger"
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
            <div className="collection-content">
              {page === "hosts" && group && (
                <div className="collection-heading">
                  <Button
                    variant="ghost"
                    type="button"
                    className="link"
                    onClick={() => {
                      setGroup("");
                      clearSelection();
                    }}
                  >
                    <ArrowLeft size={12} />
                    Tutte le cartelle
                  </Button>
                </div>
              )}
              <div
                className={
                  page === "hosts" && layout === "cards"
                    ? "table-wrap hosts-wrap cards-wrap"
                    : page === "hosts"
                      ? "table-wrap hosts-wrap"
                      : "table-wrap"
                }
              >
                {page === "hosts" ? (
                  <HostsView
                    hosts={hostRows}
                    group={group}
                    searching={Boolean(query.trim())}
                    onOpenGroup={(name) => {
                      setGroup(name);
                      clearSelection();
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
                      setHostForm({ ...host });
                      setError("");
                    }}
                    onDuplicate={(host) => {
                      setHostForm({
                        ...host,
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
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Utente SSH</th>
                        <th>Metodo / chiave</th>
                        <th>Utilizzo</th>
                        <th className="actions-col">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {identityRows.map((i) => (
                        <tr key={i.id}>
                          <td>
                            <Button
                              variant="ghost"
                              type="button"
                              className="cell-link strong"
                              disabled={busy}
                              onClick={() => editIdentity(i)}
                            >
                              <UserRound size={15} />
                              {i.name}
                            </Button>
                          </td>
                          <td className="mono">{i.username}</td>
                          <td>
                            {i.auth === "key" ? (
                              <span className="inline">
                                <KeyRound size={13} />
                                {view.keys.find((k) => k.id === i.keyId)
                                  ?.name ?? "Chiave mancante"}
                              </span>
                            ) : (
                              "Password"
                            )}
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              type="button"
                              className="cell-link"
                              onClick={() => showUsage([i.id], i.name)}
                            >
                              {i.hostCount} host
                            </Button>
                          </td>
                          <td>
                            <div className="row-actions">
                              <Button
                                variant="ghost"
                                type="button"
                                aria-label={`Modifica ${i.name}`}
                                disabled={busy}
                                onClick={() => editIdentity(i)}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                type="button"
                                aria-label={`Elimina ${i.name}`}
                                disabled={busy || i.hostCount > 0}
                                title={
                                  i.hostCount
                                    ? "Riassegna prima gli host che utilizzano questa identità"
                                    : "Elimina identità"
                                }
                                onClick={() => {
                                  setDeletion({
                                    kind: "identities",
                                    id: i.id,
                                    name: i.name,
                                  });
                                  setError("");
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Impronta pubblica</th>
                        <th>Utilizzo</th>
                        <th className="actions-col">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keyRows.map((k) => (
                        <tr key={k.id}>
                          <td>
                            <Button
                              variant="ghost"
                              type="button"
                              className="cell-link strong"
                              disabled={busy}
                              onClick={() => editKey(k)}
                            >
                              <KeyRound size={15} />
                              {k.name}
                            </Button>
                          </td>
                          <td className="mono key-fingerprint">
                            {k.fingerprint || "Da verificare"}
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              type="button"
                              className="cell-link"
                              onClick={() =>
                                showUsage(
                                  view.identities
                                    .filter((i) => i.keyId === k.id)
                                    .map((i) => i.id),
                                  k.name,
                                )
                              }
                            >
                              {k.identityCount} identità · {k.hostCount} host
                            </Button>
                          </td>
                          <td>
                            <div className="row-actions">
                              <Button
                                variant="ghost"
                                type="button"
                                aria-label={`Modifica ${k.name}`}
                                disabled={busy}
                                onClick={() => editKey(k)}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                type="button"
                                aria-label={`Elimina ${k.name}`}
                                disabled={busy || k.identityCount > 0}
                                title={
                                  k.identityCount
                                    ? "Riassegna prima le identità che utilizzano questa chiave"
                                    : "Elimina chiave"
                                }
                                onClick={() => {
                                  setDeletion({
                                    kind: "keys",
                                    id: k.id,
                                    name: k.name,
                                  });
                                  setError("");
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {((page === "hosts" && !hostRows.length) ||
                  (page === "identities" && !identityRows.length) ||
                  (page === "keys" && !keyRows.length)) && (
                  <div className="empty">
                    <h2>
                      {query || usage || group
                        ? "Nessun risultato"
                        : page === "hosts"
                          ? "Nessun host"
                          : page === "identities"
                            ? "Nessuna identità"
                            : "Nessuna chiave SSH"}
                    </h2>
                    <p>
                      {query || usage || group
                        ? "Modifica la ricerca o rimuovi i filtri."
                        : page === "hosts"
                          ? "Crea un’identità e assegnala ai tuoi server."
                          : page === "identities"
                            ? "Crea un’identità con utente SSH e una chiave dal portachiavi, oppure una password."
                            : "Importa la chiave privata una volta, poi selezionala nelle identità."}
                    </p>
                    {query || usage || group ? (
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
        {tabs.map((tab) => (
          <TerminalPane
            key={tab.id}
            tab={tab}
            active={active === tab.id}
            onError={setError}
            onStatus={tabStatus}
            onMetadata={metadataUpdated}
            onClose={() => closeTab(tab.id)}
            onRetry={() => {
              closeTab(tab.id);
              if (tab.kind === "ssh") {
                const host = view.hosts.find((h) => h.id === tab.host.id);
                if (host) connect(host);
              } else if (tab.kind === "local") openLocal();
              else openQuick(tab.target);
            }}
            onEdit={
              tab.kind === "ssh"
                ? () => {
                    const host = view.hosts.find((h) => h.id === tab.host.id);
                    if (host) {
                      setActive("vault");
                      setHostForm({ ...host });
                    }
                  }
                : undefined
            }
          />
        ))}
      </main>
      {hostForm && !identityForm && !keyForm && (
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
            <p className="muted">
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
          <p className="help">
            {deletion.kind === "hosts"
              ? "La chiave e l’identità associate verranno conservate. Il server remoto non viene modificato."
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
              data-alert-cancel
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setDeletion(null)}
            >
              Annulla
            </Button>
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
                        : "delete_key";
                  for (const id of deletion.ids ?? [deletion.id]) {
                    update(await invokeScoped<View>(command, { id }));
                  }
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
      {settings && (
        <Panel
          title="Sincronizzazione"
          footer={
            <footer>
              <Button
                variant="ghost"
                disabled={busy}
                type="button"
                onClick={() => {
                  setSettings(false);
                  setSyncToken("");
                }}
              >
                Annulla
              </Button>
              <Button
                variant="default"
                type="submit"
                form="sync-settings-form"
                className="primary"
                disabled={busy}
              >
                Salva configurazione
              </Button>
            </footer>
          }
          busy={busy}
          error={error}
          onClose={() => {
            setSettings(false);
            setSyncToken("");
            setError("");
          }}
        >
          <form
            id="sync-settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                update(
                  await invokeScoped<View>("configure_sync", {
                    url: syncUrlForVault(syncUrl, view.vaultId),
                    token: syncToken,
                  }),
                );
                setSyncToken("");
                setSettings(false);
                setNotice("Configurazione salvata");
              });
            }}
          >
            <p className="muted">
              La sync è opzionale. Host, identità e chiavi vengono sincronizzati
              insieme, cifrati.
            </p>
            <label>
              URL servizio
              <Input
                autoFocus
                required
                type="url"
                placeholder="https://sync.example.com"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
              />
            </label>
            <p className="help">
              {view.vaultId === "personal"
                ? "Il vault Personale conserva l’endpoint compatibile /vault."
                : `Inserendo l’indirizzo del servizio verrà usato /vaults/${view.vaultId}. Per collegare un altro dispositivo copia l’URL completo dopo il salvataggio.`}
            </p>
            <label>
              Token
              <Input
                type="password"
                autoComplete="off"
                required={!view.syncConfigured}
                minLength={syncToken ? 32 : undefined}
                placeholder={
                  view.syncConfigured
                    ? "Vuoto per mantenere il token esistente"
                    : "Almeno 32 caratteri"
                }
                value={syncToken}
                onChange={(e) => setSyncToken(e.target.value)}
              />
            </label>
            <p className="help">
              Controllo ogni 30 secondi a vault sbloccato. In caso di modifiche
              concorrenti, la sync si ferma e conserva i dati locali.
            </p>
          </form>
        </Panel>
      )}
      {shortcuts && (
        <Panel
          variant="dialog"
          title="Scorciatoie da tastiera"
          busy={false}
          error=""
          onClose={() => setShortcuts(false)}
        >
          <p className="muted">
            Su macOS usa ⌘ al posto di Ctrl. Le scorciatoie di ricerca e blocco
            usano anche Maiusc per lasciare liberi i comandi del terminale.
          </p>
          <dl className="shortcut-list">
            <div>
              <dt>Connessione rapida</dt>
              <dd>
                <kbd>Ctrl/Cmd K / Ctrl/Cmd T</kbd>
              </dd>
            </div>
            <div>
              <dt>Nuovo host</dt>
              <dd>
                <kbd>Ctrl N</kbd>
              </dd>
            </div>
            <div>
              <dt>Cerca nella raccolta</dt>
              <dd>
                <kbd>Ctrl Maiusc F</kbd>
              </dd>
            </div>
            <div>
              <dt>Blocca vault</dt>
              <dd>
                <kbd>Ctrl Maiusc L</kbd>
              </dd>
            </div>
            <div>
              <dt>Connetti dalla scheda host</dt>
              <dd>
                <kbd>Invio</kbd>
              </dd>
            </div>
            <div>
              <dt>Seleziona host</dt>
              <dd>
                <kbd>Spazio / Ctrl/Cmd clic</kbd>
              </dd>
            </div>
            <div>
              <dt>Annulla selezione o chiudi pannello</dt>
              <dd>
                <kbd>Esc</kbd>
              </dd>
            </div>
          </dl>
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
          <p className="help">
            Confronta questa impronta con quella fornita dall’amministratore o
            dalla console del server prima di inviare le credenziali.
          </p>
          <code className="fingerprint">{trust.fingerprint}</code>
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
createRoot(document.getElementById("root")!).render(<App />);
