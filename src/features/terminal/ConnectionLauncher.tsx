import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Group, Host, Identity, Workspace } from "@/lib/types";
import { parseConnectionTarget } from "./connection-target.mjs";
import { launcherResults, togglePicked } from "./launcher-results.mjs";
import type {
  LauncherResult,
  LauncherTab,
  RecentHost,
} from "./launcher-results.mjs";
import { LauncherActions } from "./LauncherActions";
import { LauncherRow } from "./LauncherRow";
import { PickingActions } from "./PickingActions";
import { QuickConnectForm } from "./QuickConnectForm";
import type { QuickConnection } from "./tabs-types";

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
  // formatted binding of the quick-connect shortcut; empty when unbound
  shortcut: string;
  busy: boolean;
};

const sectionClass =
  "mb-[18px] rounded-[12px] border border-border bg-card p-[6px]";
const headerClass =
  "flex min-h-[38px] items-center justify-between pr-[6px] pl-[10px]";

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
  shortcut,
  busy,
}: ConnectionLauncherProps) {
  const [query, setQuery] = useState("");
  const identitySelect = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState(0);
  const [armed, setArmed] = useState<string>();
  // hosts being picked for a new workspace; null when not picking
  const [picked, setPicked] = useState<string[] | null>(null);
  const [identityId, setIdentityId] = useState(
    identities.length === 1 ? identities[0].id : "",
  );
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(undefined), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  const { text, hasRecent, results } = launcherResults({
    query,
    vaultName,
    groups,
    hosts,
    identities,
    workspaces,
    tabs,
    selecting: picked !== null,
  });
  const target = parseConnectionTarget(query);
  const hasIdentity = identities.some((identity) => identity.id === identityId);
  const canQuickConnect = hasIdentity && !busy && !preview;
  const quickConnect = () =>
    target && onQuickConnect({ ...target, identityId });
  const selected = Math.min(selection, Math.max(0, results.length - 1));
  useEffect(() => {
    document
      .querySelector("[data-launch-selected]")
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const activate = ({ kind, workspace, tab, host }: LauncherResult) => {
    if (kind === "workspace") onOpenWorkspace(workspace!);
    else if (kind === "tab") onActivateTab(tab!.id);
    else if (picked) setPicked(togglePicked(picked, host!.id));
    else onConnect(host!);
  };
  const row = (result: LauncherResult, index: number) => (
    <LauncherRow
      key={result.key}
      result={result}
      selected={selected === index}
      checked={
        picked && result.host ? picked.includes(result.host.id) : undefined
      }
      armed={!!result.workspace && armed === result.workspace.id}
      busy={busy}
      onHover={() => setSelection(index)}
      onActivate={() => activate(result)}
      onArmDelete={() => setArmed(result.workspace!.id)}
      onDelete={() => {
        setArmed(undefined);
        onDeleteWorkspace(result.workspace!);
      }}
    />
  );
  const rowsOf = (...kinds: string[]) =>
    results.flatMap((result, index) =>
      kinds.includes(result.kind) ? [row(result, index)] : [],
    );
  const workspaceRows = rowsOf("workspace");
  const otherRows = rowsOf("tab", "host");
  const onKeyDown = (event: React.KeyboardEvent) => {
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
      activate(results[selected]);
    }
    if (
      event.key === "Enter" &&
      !results.length &&
      target &&
      !busy &&
      !preview
    ) {
      event.preventDefault();
      if (hasIdentity) quickConnect();
      else identitySelect.current?.focus();
    }
    if (event.key === "Escape") {
      setQuery("");
      setSelection(0);
    }
  };
  return (
    <section
      className="mx-auto min-h-0 w-full max-w-[760px] flex-1 overflow-auto px-[24px] pt-[40px] pb-[56px]"
      aria-label="Nuova scheda"
    >
      <div className="mb-[20px] flex items-center gap-[10px] rounded-[9px] border border-input bg-field px-[12px] text-muted-foreground focus-within:border-ring">
        <Search size={16} />
        <Input
          className="h-[40px] min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 shadow-none outline-none focus-visible:border-0 focus-visible:outline-none"
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
          onKeyDown={onKeyDown}
        />
        {shortcut && (
          <kbd className="text-[12px] whitespace-nowrap">{shortcut}</kbd>
        )}
      </div>
      <div
        id="connection-results"
        role="listbox"
        aria-label={text ? "Risultati ricerca" : "Connessioni disponibili"}
      >
        {workspaceRows.length > 0 && (
          <div className={sectionClass}>
            <div className={headerClass}>
              <h2 className="m-0 text-[13px]">Workspace</h2>
            </div>
            {workspaceRows}
          </div>
        )}
        <div className={sectionClass}>
          <div className={headerClass}>
            <h2 className="m-0 text-[13px]">
              {picked
                ? "Scegli gli host"
                : text
                  ? "Risultati"
                  : hasRecent
                    ? "Connessioni recenti"
                    : "Host salvati"}
            </h2>
            <div className="flex items-center gap-[2px]">
              {picked ? (
                <PickingActions
                  count={picked.length}
                  busy={busy}
                  onCancel={() => setPicked(null)}
                  onCreate={() => {
                    onCreateWorkspace(picked);
                    setPicked(null);
                  }}
                />
              ) : (
                <LauncherActions
                  busy={busy}
                  preview={preview}
                  canPickHosts={hosts.length >= 2}
                  session={session}
                  onLocalTerminal={onLocalTerminal}
                  onPickHosts={() => setPicked([])}
                  onRestore={onRestore}
                />
              )}
            </div>
          </div>
          {otherRows}
          {!otherRows.length && (
            <p className="px-[10px] pt-[18px] pb-[14px] text-[13px] text-muted-foreground">
              {text
                ? "Nessun host o scheda corrisponde alla ricerca."
                : "Nessun host salvato. Aggiungine uno dal Vault o digita un indirizzo SSH."}
            </p>
          )}
        </div>
      </div>
      {target && (
        <QuickConnectForm
          target={target}
          identities={identities}
          identityId={identityId}
          canConnect={canQuickConnect}
          selectRef={identitySelect}
          onIdentityChange={setIdentityId}
          onSubmit={quickConnect}
        />
      )}
      {preview && (
        <p className="help mt-[16px]">
          Anteprima: connessioni SSH e terminale locale sono disponibili
          nell’app desktop.
        </p>
      )}
    </section>
  );
}
