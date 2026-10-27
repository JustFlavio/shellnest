import { useEffect, useState } from "react";
import { quickConnectTarget } from "./connection-target.ts";
import { Command } from "@/components/ui/command";
import { mac } from "@/lib/platform";
import {
  emptyMessage,
  groupResults,
  launcherResults,
  togglePicked,
} from "./launcher-results.ts";
import type { LauncherResult } from "./launcher-results.ts";
import type { ConnectionLauncherProps } from "./launcher-props.ts";
import { launcherKeyHandler } from "./launcher-keys";
import { LauncherList } from "./LauncherList";
import { LauncherRow } from "./LauncherRow";
import { LauncherSearch } from "./LauncherSearch";
import { LauncherToolbar } from "./LauncherToolbar";

const quickKey = mac ? "⌘Invio" : "Ctrl+Invio";

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
  mode,
  shortcut,
  busy,
}: ConnectionLauncherProps) {
  const jump = mode === "jump";
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(0);
  const [armed, setArmed] = useState<string>();
  // hosts being picked for a new workspace; null when not picking
  const [picked, setPicked] = useState<string[] | null>(null);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(undefined), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  // Cmd/Ctrl+Enter takes any text that parses as an address, not only what looks like one.
  const forcedTarget = jump ? null : quickConnectTarget(query, hosts, true);
  const target = jump || picked ? null : quickConnectTarget(query, hosts);
  const { text, hasRecent, results } = launcherResults({
    query,
    vaultName,
    groups,
    hosts,
    identities,
    workspaces,
    tabs,
    selecting: picked !== null,
    target,
    jump,
  });
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
    target,
  }: LauncherResult) => {
    if (busy || (kind === "local" && preview)) return;
    if (kind === "local") onLocalTerminal();
    else if (kind === "target") onQuickConnect(target!);
    else if (kind === "workspace") onOpenWorkspace(workspace!);
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
      busy={busy || (result.kind === "local" && preview)}
      onActivate={() => activate(result)}
      onNewSession={() => onConnect(result.host!)}
      onArmDelete={() => setArmed(result.workspace!.id)}
      onDelete={() => {
        setArmed(undefined);
        onDeleteWorkspace(result.workspace!);
      }}
    />
  );
  const onKeyDown = launcherKeyHandler({
    results,
    selected,
    picked: !!picked,
    busy,
    target,
    forcedTarget,
    activate,
    select: setSelection,
    clear: () => {
      setQuery("");
      setSelection(0);
    },
    onConnect,
    onQuickConnect,
  });
  const listed = results.some((r) => r.group === "tabs" || r.group === "hosts");
  const empty = listed
    ? null
    : emptyMessage({
        jump,
        text,
        hasTarget: !!target,
        nothingSaved: !hosts.length && !tabs.length,
        quickKey,
      });
  return (
    <section
      className="mx-auto min-h-0 w-full max-w-[760px] flex-1 overflow-auto px-[24px] pt-[40px] pb-[56px]"
      aria-label={jump ? "Vai alla scheda" : "Nuova scheda"}
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
          placeholder={
            jump
              ? "Vai alla scheda"
              : "Cerca host o schede · ssh utente@host -p 22"
          }
          onChange={(value) => {
            setQuery(value);
            setSelection(0);
          }}
          onKeyDown={onKeyDown}
        />
        {!jump && (
          <LauncherToolbar
            picked={picked}
            busy={busy}
            canPickHosts={hosts.length >= 2}
            session={session}
            onCancel={() => setPicked(null)}
            onCreate={() => {
              onCreateWorkspace(picked!);
              setPicked(null);
            }}
            onPickHosts={() => setPicked([])}
            onRestore={onRestore}
          />
        )}
        <LauncherList
          label={text ? "Risultati ricerca" : "Connessioni disponibili"}
          groups={groupResults(results, {
            picking: !!picked,
            text,
            hasRecent,
          })}
          empty={empty}
          renderRow={row}
        />
      </Command>
      {preview && (
        <p className="help mt-[16px]">
          Anteprima: connessioni SSH e terminale locale sono disponibili
          nell’app desktop.
        </p>
      )}
    </section>
  );
}
