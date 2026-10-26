import { SelectField } from "./SelectField";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  History,
  LayoutGrid,
  Search,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import type { Group, Host, Identity, Workspace } from "./types";
import { groupPath } from "./groups.mjs";
import { parseConnectionTarget } from "./connection-target.mjs";
import type { ConnectionTarget } from "./connection-target.mjs";
import { OsIcon } from "./OsIcon";

type RecentHost = Host & {
  lastConnectedAt?: number | null;
  os?: string | null;
};
export type QuickConnection = ConnectionTarget & { identityId: string };
type LauncherTab = { id: string; title: string; subtitle?: string };
export type ConnectionLauncherProps = {
  vaultName: string;
  groups: Group[];
  hosts: RecentHost[];
  identities: Identity[];
  workspaces: Workspace[];
  tabs: LauncherTab[];
  onConnect: (host: Host) => void;
  onOpenWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  session: { count: number } | null;
  onRestore: () => void;
  onCreateWorkspace: (hostIds: string[]) => void;
  onActivateTab: (id: string) => void;
  onLocalTerminal: () => void;
  onQuickConnect: (target: QuickConnection) => void;
  preview: boolean;
  busy: boolean;
};

// Saved layouts count their leaves the same way a live layout does.
const MAX_WORKSPACE_HOSTS = 16;
const connectionCount = (workspace: Workspace) => {
  const count = (n: Workspace["layout"]): number =>
    "dir" in n ? count(n.a) + count(n.b) : 1;
  return count(workspace.layout);
};

export function ConnectionLauncher({
  vaultName,
  groups,
  hosts,
  identities,
  workspaces,
  tabs,
  onConnect,
  onOpenWorkspace,
  onDeleteWorkspace,
  session,
  onRestore,
  onCreateWorkspace,
  onActivateTab,
  onLocalTerminal,
  onQuickConnect,
  preview,
  busy,
}: ConnectionLauncherProps) {
  const [query, setQuery] = useState("");
  const identitySelect = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState(0);
  const [armed, setArmed] = useState<string>();
  const [picked, setPicked] = useState<string[] | null>(null);
  const selecting = picked !== null;
  const toggle = (id: string) =>
    setPicked((old) =>
      !old
        ? old
        : old.includes(id)
          ? old.filter((x) => x !== id)
          : old.length < MAX_WORKSPACE_HOSTS
            ? [...old, id]
            : old,
    );
  const [identityId, setIdentityId] = useState(
    identities.length === 1 ? identities[0].id : "",
  );
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(undefined), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  const text = query.trim().toLocaleLowerCase();
  const sorted = useMemo(
    () =>
      [...hosts].sort(
        (a, b) =>
          (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    [hosts],
  );
  const hasRecent = sorted.some((h) => (h.lastConnectedAt ?? 0) > 0);
  const matchingHosts = text
    ? sorted.filter((host) =>
        `${host.name} ${host.address} ${groupPath(groups, host.groupId)} ${identities.find((identity) => identity.id === (host.effectiveIdentityId || host.identityId))?.username ?? host.username ?? ""}`
          .toLocaleLowerCase()
          .includes(text),
      )
    : sorted;
  const target = parseConnectionTarget(query);
  const matches = (value: string) =>
    !text || value.toLocaleLowerCase().includes(text);
  const allResults = [
    ...workspaces
      .filter((workspace) => matches(workspace.name))
      .map((workspace) => ({
        key: `workspace-${workspace.id}`,
        kind: "workspace" as const,
        title: workspace.name,
        path: `${connectionCount(workspace)} connessioni`,
        os: undefined,
        workspace,
        activate: () => onOpenWorkspace(workspace),
        hostId: undefined,
      })),
    ...(text
      ? tabs.filter((tab) => matches(`${tab.title} ${tab.subtitle ?? ""}`))
      : []
    ).map((tab) => ({
      key: `tab-${tab.id}`,
      kind: "tab" as const,
      title: tab.title,
      path: tab.subtitle ?? "Scheda aperta",
      os: undefined,
      workspace: undefined,
      activate: () => onActivateTab(tab.id),
      hostId: undefined,
    })),
    ...matchingHosts.map((host) => ({
      key: `host-${host.id}`,
      kind: "host" as const,
      title: host.name,
      path: host.groupId
        ? `${vaultName} / ${groupPath(groups, host.groupId)}`
        : vaultName,
      os: host.os,
      workspace: undefined,
      activate: () => (selecting ? toggle(host.id) : onConnect(host)),
      hostId: host.id,
    })),
  ];
  const results = selecting
    ? allResults.filter((result) => result.kind === "host")
    : allResults;
  const selected = Math.min(selection, Math.max(0, results.length - 1));
  useEffect(() => {
    document
      .querySelector(".launch-row.selected")
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const row = (result: (typeof results)[number], index: number) => (
    <div
      key={result.key}
      className={`launch-row${selected === index ? " selected" : ""}`}
    >
      <Button
        variant="ghost"
        type="button"
        id={`connection-${result.key}`}
        role="option"
        aria-selected={selected === index}
        aria-checked={
          selecting && result.hostId
            ? picked.includes(result.hostId)
            : undefined
        }
        disabled={busy}
        onMouseEnter={() => setSelection(index)}
        onClick={result.activate}
      >
        {selecting && result.hostId && (
          <span
            className={`launch-check${picked.includes(result.hostId) ? " on" : ""}`}
            aria-hidden
          >
            {picked.includes(result.hostId) && <Check size={11} />}
          </span>
        )}
        {result.kind === "workspace" ? (
          <span className="launch-workspace-icon">
            <LayoutGrid size={14} />
          </span>
        ) : (
          <OsIcon os={result.os} />
        )}
        <span className="launch-row-name">{result.title}</span>
        <span className="launch-row-path">{result.path}</span>
      </Button>
      {result.workspace && (
        <Button
          variant="ghost"
          type="button"
          className={`launch-row-delete${armed === result.workspace.id ? " armed" : ""}`}
          aria-label={`Elimina workspace ${result.title}`}
          disabled={busy}
          onClick={() => {
            if (armed === result.workspace!.id) {
              setArmed(undefined);
              onDeleteWorkspace(result.workspace!);
            } else setArmed(result.workspace!.id);
          }}
        >
          {armed === result.workspace.id ? "Conferma" : <Trash2 size={13} />}
        </Button>
      )}
    </div>
  );
  const indexed = results.map((result, index) => ({ result, index }));
  const section = (kinds: string[]) =>
    indexed.filter(({ result }) => kinds.includes(result.kind));
  const workspaceRows = section(["workspace"]),
    otherRows = section(["tab", "host"]);
  return (
    <section className="launch" aria-label="Nuova scheda">
      <div className="launch-search">
        <Search size={16} />
        <Input
          autoFocus
          aria-label="Cerca host o schede"
          placeholder="Cerca host o schede · ssh utente@host -p 22"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelection(0);
          }}
          aria-controls="connection-results"
          aria-activedescendant={
            results.length ? `connection-${results[selected].key}` : undefined
          }
          role="combobox"
          aria-expanded={results.length > 0}
          aria-autocomplete="list"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setSelection((selected + 1) % results.length);
            }
            if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setSelection((selected + results.length - 1) % results.length);
            }
            if (event.key === "Enter" && results.length && !busy) {
              event.preventDefault();
              results[selected].activate();
            }
            if (
              event.key === "Enter" &&
              !results.length &&
              target &&
              !busy &&
              !preview
            ) {
              event.preventDefault();
              if (identities.some((identity) => identity.id === identityId))
                onQuickConnect({ ...target, identityId });
              else identitySelect.current?.focus();
            }
            if (event.key === "Escape") {
              setQuery("");
              setSelection(0);
            }
          }}
        />
        <kbd>{/Mac/.test(navigator.userAgent) ? "⌘K" : "Ctrl K"}</kbd>
      </div>
      <div
        id="connection-results"
        role="listbox"
        aria-label={text ? "Risultati ricerca" : "Connessioni disponibili"}
      >
        {!selecting && workspaceRows.length > 0 && (
          <div className="launch-card">
            <div className="launch-card-head">
              <h2>Workspace</h2>
            </div>
            {workspaceRows.map(({ result, index }) => row(result, index))}
          </div>
        )}
        <div className="launch-card">
          <div className="launch-card-head">
            <h2>
              {selecting
                ? "Scegli gli host"
                : text
                  ? "Risultati"
                  : hasRecent
                    ? "Connessioni recenti"
                    : "Host salvati"}
            </h2>
            <div className="launch-card-actions">
              {selecting ? (
                <>
                  <span className="launch-count">
                    {picked.length}/{MAX_WORKSPACE_HOSTS}
                  </span>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setPicked(null)}
                  >
                    Annulla
                  </Button>
                  <Button
                    variant="default"
                    type="button"
                    className="primary"
                    disabled={busy || picked.length < 2}
                    onClick={() => {
                      onCreateWorkspace(picked);
                      setPicked(null);
                    }}
                  >
                    Crea workspace
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={busy || preview}
                    onClick={onLocalTerminal}
                  >
                    <TerminalSquare size={14} />
                    Terminale locale
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={busy || hosts.length < 2}
                    onClick={() => setPicked([])}
                  >
                    <LayoutGrid size={14} />
                    Crea workspace
                  </Button>
                  {session && (
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={busy}
                      title="Riapre le schede dell’ultima sessione su questo dispositivo"
                      onClick={onRestore}
                    >
                      <History size={14} />
                      Ripristina ({session.count})
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {otherRows.map(({ result, index }) => row(result, index))}
          {!otherRows.length && (
            <p className="launch-empty">
              {text
                ? "Nessun host o scheda corrisponde alla ricerca."
                : "Nessun host salvato. Aggiungine uno dal Vault o digita un indirizzo SSH."}
            </p>
          )}
        </div>
      </div>
      {target && (
        <form
          className="launcher-quick"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              identities.some((identity) => identity.id === identityId) &&
              !busy &&
              !preview
            )
              onQuickConnect({ ...target, identityId });
          }}
        >
          <h2>Connessione rapida</h2>
          <p className="muted">
            <code>
              {target.username ? `${target.username}@` : ""}
              {target.address.includes(":")
                ? `[${target.address}]`
                : target.address}
              :{target.port}
            </code>
          </p>
          <div className="launcher-quick-fields">
            <label>
              Identità
              <SelectField
                ref={identitySelect}
                aria-label="Identità per connessione rapida"
                required
                value={identityId}
                onValueChange={setIdentityId}
                placeholder="Seleziona un’identità"
                options={identities.map((identity) => ({
                  value: identity.id,
                  label: identity.name + " — " + identity.username,
                }))}
              />
            </label>
            <Button
              variant="default"
              type="submit"
              className="primary"
              disabled={
                busy ||
                preview ||
                !identities.some((identity) => identity.id === identityId)
              }
            >
              Connetti
            </Button>
          </div>
          <p className="help">
            Usa le credenziali dell’identità scelta senza salvare un host.
            {target.username
              ? " L’utente indicato vale solo per questa connessione."
              : ""}
          </p>
        </form>
      )}
      {preview && (
        <p className="launch-preview help">
          Anteprima: connessioni SSH e terminale locale sono disponibili
          nell’app desktop.
        </p>
      )}
    </section>
  );
}
