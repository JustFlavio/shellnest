import { useEffect, useRef, useState } from "react";
import { quickConnectTarget } from "./connection-target.ts";
import { Command } from "@/components/ui/command";
import {
  emptyMessage,
  groupResults,
  launcherResults,
} from "./launcher-results.ts";
import {
  clickRow,
  collapsed,
  isSelected,
  markedHostIds,
} from "./launcher-selection.ts";
import type { ClickMode } from "./launcher-selection.ts";
import type { LauncherResult } from "./launcher-results.ts";
import type { ConnectionLauncherProps } from "./launcher-props.ts";
import { launcherKeyHandler } from "./launcher-keys";
import { LauncherList } from "./LauncherList";
import { LauncherRow } from "./LauncherRow";
import { LauncherSearch } from "./LauncherSearch";
import { LauncherToolbar } from "./LauncherToolbar";

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
  const [selection, setSelection] = useState(collapsed);
  const [armed, setArmed] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(undefined), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  // Cmd/Ctrl+Enter takes any text that parses as an address, not only what looks like one.
  const forcedTarget = jump ? null : quickConnectTarget(query, hosts, true);
  const target = jump ? null : quickConnectTarget(query, hosts);
  const { text, hasRecent, results } = launcherResults({
    query,
    vaultName,
    groups,
    hosts,
    identities,
    workspaces,
    tabs,
    target,
    jump,
  });
  const selected = Math.min(selection.cursor, Math.max(0, results.length - 1));
  const hostIds = markedHostIds(results, selection.marks);
  useEffect(() => {
    document
      .querySelector("[data-launch-selected]")
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  // cmdk marks only its one highlighted item as aria-selected, and rewrites it after our
  // effect when the cursor moves; mirror the multi-selection once that render is done.
  useEffect(() => {
    queueMicrotask(() =>
      listRef.current
        ?.querySelectorAll("[cmdk-item]")
        .forEach((item, index) =>
          item.setAttribute(
            "aria-selected",
            String(
              !!results[index] &&
                isSelected({ ...selection, cursor: selected }, results, index),
            ),
          ),
        ),
    );
  });
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
    else if (openTab) onActivateTab(openTab.id);
    else onConnect(host!);
  };
  // cmdk reports a clicked row as its new value right after; the click already set the cursor
  const clicking = useRef(false);
  const click = (index: number, mode: ClickMode) => {
    clicking.current = true;
    queueMicrotask(() => (clicking.current = false));
    setSelection((current) => clickRow(current, results, index, mode));
  };
  const row = (result: LauncherResult, index: number) => (
    <LauncherRow
      key={result.key}
      result={result}
      cursor={selected === index}
      selected={isSelected({ ...selection, cursor: selected }, results, index)}
      armed={!!result.workspace && armed === result.workspace.id}
      busy={busy || (result.kind === "local" && preview)}
      onClick={(mode) => click(index, mode)}
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
    marked: selection.marks.length > 0,
    unmark: () => setSelection((current) => ({ ...current, marks: [] })),
    busy,
    target,
    forcedTarget,
    activate,
    select: (index) => setSelection(collapsed(index)),
    clear: () => {
      setQuery("");
      setSelection(collapsed());
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
      });
  return (
    <section
      ref={listRef}
      className="mx-auto min-h-0 w-full max-w-[760px] flex-1 overflow-auto px-[24px] pt-[40px] pb-[56px]"
      aria-label={jump ? "Vai alla scheda" : "Nuova scheda"}
    >
      <Command
        shouldFilter={false}
        label="Cerca host o schede"
        value={results[selected]?.key ?? ""}
        disablePointerSelection
        onValueChange={(key) => {
          const index = results.findIndex((result) => result.key === key);
          if (index >= 0 && !clicking.current)
            setSelection((current) => ({ ...current, cursor: index }));
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
            setSelection(collapsed());
          }}
          onKeyDown={onKeyDown}
        />
        {!jump && (
          <LauncherToolbar
            busy={busy}
            canCreate={hostIds.length >= 2}
            session={session}
            onCreate={() => {
              onCreateWorkspace(hostIds);
              setSelection(collapsed(selected));
            }}
            onRestore={onRestore}
          />
        )}
        <LauncherList
          label={text ? "Risultati ricerca" : "Connessioni disponibili"}
          multiselectable={!jump}
          groups={groupResults(results, { text, hasRecent })}
          empty={empty}
          renderRow={row}
        />
      </Command>
    </section>
  );
}
