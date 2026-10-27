import { useEffect, useRef, useState } from "react";
import type { Group, Host, Identity, Workspace } from "@/lib/types";
import { quickConnectTarget } from "./connection-target.ts";
import {
  Command,
  CommandGroup,
  CommandList,
} from "@/components/ui/command";
import { mac } from "@/lib/platform";
import {
  launcherKeyAction,
  launcherResults,
  listHeading,
  togglePicked,
} from "./launcher-results.ts";
import type {
  LauncherResult,
  LauncherTab,
  RecentHost,
} from "./launcher-results.ts";
import { LauncherActions } from "./LauncherActions";
import { LauncherRow } from "./LauncherRow";
import { LauncherSearch } from "./LauncherSearch";
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

const quickKey = mac ? "⌘Invio" : "Ctrl+Invio";

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
  // Cmd/Ctrl+Enter showed the quick-connect card for text that is not plainly a target
  const [revealed, setRevealed] = useState(false);
  const [pickerRequest, setPickerRequest] = useState(0);
  const [identityId, setIdentityId] = useState(
    identities.length === 1 ? identities[0].id : "",
  );
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(undefined), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  useEffect(() => {
    if (pickerRequest) identitySelect.current?.focus();
  }, [pickerRequest]);
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
  const target = quickConnectTarget(query, hosts, revealed);
  const isTarget = !!quickConnectTarget(query, hosts);
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
  const activate = ({
    kind,
    workspace,
    tab,
    host,
    openTab,
  }: LauncherResult) => {
    if (busy) return;
    if (kind === "workspace") onOpenWorkspace(workspace!);
    else if (kind === "tab") onActivateTab(tab!.id);
    else if (picked) setPicked(togglePicked(picked, host!.id));
    else if (openTab) onActivateTab(openTab.id);
    else onConnect(host!);
  };
  const pickedSet = new Set(picked);
  const row = (result: LauncherResult, index: number) => (
    <LauncherRow
      key={result.key}
      result={result}
      selected={selected === index}
      checked={
        picked && result.host ? pickedSet.has(result.host.id) : undefined
      }
      armed={!!result.workspace && armed === result.workspace.id}
      busy={busy}
      onActivate={() => activate(result)}
      onNewSession={() => onConnect(result.host!)}
      onArmDelete={() => setArmed(result.workspace!.id)}
      onDelete={() => {
        setArmed(undefined);
        onDeleteWorkspace(result.workspace!);
      }}
    />
  );
  const rowsOf = (workspaces: boolean) =>
    results.flatMap((result, index) =>
      (result.kind === "workspace") === workspaces ? [row(result, index)] : [],
    );
  const workspaceRows = rowsOf(true);
  const otherRows = rowsOf(false);
  const onKeyDown = (event: React.KeyboardEvent) => {
    const current = results[selected];
    if (
      event.key === "Enter" &&
      event.shiftKey &&
      current?.openTab &&
      !picked &&
      !busy
    ) {
      event.preventDefault();
      onConnect(current.host!);
      return;
    }
    const action = launcherKeyAction(event.key, {
      count: results.length,
      selected,
      busy,
      canQuickConnect: isTarget && !busy && !preview,
      modified: event.metaKey || event.ctrlKey,
      hasText: !!text,
      ready: hasIdentity,
    });
    if (!action) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    if (action.type === "clear") {
      setQuery("");
      setRevealed(false);
      setSelection(0);
      return;
    }
    event.preventDefault();
    if (action.type === "reveal") {
      setRevealed(true);
      setPickerRequest((n) => n + 1);
    } else if (action.type === "select") setSelection(action.index);
    else if (action.type === "activate") activate(results[selected]);
    else if (hasIdentity) quickConnect();
    else identitySelect.current?.focus();
  };
  const nothingSaved = !hosts.length && !tabs.length;
  const emptyMessage = nothingSaved
    ? text
      ? target
        ? "Nessun host o scheda corrisponde alla ricerca."
        : `Nessun host salvato. Premi ${quickKey} per una connessione rapida o crea un host dal Vault.`
      : "Nessun host salvato. Aggiungine uno dal Vault o digita un indirizzo SSH."
    : "Nessun host o scheda corrisponde alla ricerca.";
  return (
    <section
      className="mx-auto min-h-0 w-full max-w-[760px] flex-1 overflow-auto px-[24px] pt-[40px] pb-[56px]"
      aria-label="Nuova scheda"
    >
      <Command
        shouldFilter={false}
        label="Cerca host o schede"
        value={results[selected]?.key ?? ""}
        onValueChange={(key) => {
          const index = results.findIndex((result) => result.key === key);
          if (index >= 0) setSelection(index);
        }}
        className="h-auto overflow-visible rounded-none! bg-transparent p-0 text-inherit"
      >
        <LauncherSearch
          value={query}
          shortcut={shortcut}
          onChange={(value) => {
            setQuery(value);
            setRevealed(false);
            setSelection(0);
          }}
          onKeyDown={onKeyDown}
        />
        <CommandList
          label={text ? "Risultati ricerca" : "Connessioni disponibili"}
          className="max-h-none overflow-visible"
        >
          {workspaceRows.length > 0 && (
            <div className={sectionClass}>
              <div className={headerClass}>
                <h2 className="m-0 text-[13px]">Workspace</h2>
              </div>
              <CommandGroup className="p-0">{workspaceRows}</CommandGroup>
            </div>
          )}
          <div className={sectionClass}>
            <div className={headerClass}>
              <h2 className="m-0 text-[13px]">
                {listHeading({ picking: !!picked, text, hasRecent })}
              </h2>
              <div
                className="flex items-center gap-[2px]"
                onKeyDown={(event) => event.stopPropagation()}
              >
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
            <CommandGroup className="p-0">{otherRows}</CommandGroup>
            {!otherRows.length && (
              <p className="px-[10px] pt-[18px] pb-[14px] text-[13px] text-muted-foreground">
                {emptyMessage}
              </p>
            )}
          </div>
        </CommandList>
      </Command>
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
      <p className="help mt-[16px]">
        Invio apre · Maiusc+Invio nuova sessione · {quickKey} connessione rapida
      </p>
      {preview && (
        <p className="help mt-[16px]">
          Anteprima: connessioni SSH e terminale locale sono disponibili
          nell’app desktop.
        </p>
      )}
    </section>
  );
}
