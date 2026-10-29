import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { quickConnectTarget } from "./connection-target.ts";
import { Command } from "@/components/ui/command";
import {
  emptyMessage,
  groupResults,
  launcherResults,
  menuResults,
} from "./launcher-results.ts";
import {
  clickRow,
  collapsed,
  isSelected,
  markedHostIds,
  pickedHosts,
} from "./launcher-selection.ts";
import type { ClickMode } from "./launcher-selection.ts";
import type { LauncherResult } from "./launcher-results.ts";
import type { ConnectionLauncherProps } from "./launcher-props.ts";
import { launcherKeyHandler } from "./launcher-keys";
import { LauncherList } from "./LauncherList";
import { LauncherRow } from "./LauncherRow";
import { LauncherSearch } from "./LauncherSearch";
import { LauncherActions } from "./LauncherActions";
import { SearchMenu } from "./SearchMenu";

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
  onRestore,
  onCreateWorkspace,
  onActivateTab,
  onLocalTerminal,
  onQuickConnect,
  preview,
  mode,
  shortcut,
  jumpShortcut,
  busy,
}: ConnectionLauncherProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [jump, setJump] = useState(mode === "jump");
  const [open, setOpen] = useState(mode === "jump");
  const [menuCursor, setMenuCursor] = useState(0);
  const [selection, setSelection] = useState(collapsed);
  const [armed, setArmed] = useState<string>();
  const searchRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(undefined), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  // Cmd/Ctrl+Enter takes any text that parses as an address, not only what looks like one.
  const forcedTarget = quickConnectTarget(query, hosts, true);
  const target = quickConnectTarget(query, hosts);
  const { hasRecent, results: page } = launcherResults({
    query: "",
    vaultName,
    groups,
    hosts,
    identities,
    workspaces,
    tabs,
  });
  const pageResults = page.filter((r) => r.group !== "quick");
  const menuInput = {
    query,
    vaultName,
    groups,
    hosts,
    identities,
    tabs,
    jump,
  };
  // Text that matches no host or tab is offered as a target when it parses; otherwise the
  // menu says so instead of opening the local terminal on Enter.
  const matched = menuResults(menuInput).results.some(
    (r) => r.group !== "quick",
  );
  const shown = target ?? (matched ? null : forcedTarget);
  const invalid = !jump && !!query.trim() && !matched && !shown;
  const menu = menuResults({ ...menuInput, target: shown });
  const menuRows = invalid ? [] : menu.results;
  const menuSelected = Math.min(menuCursor, menuRows.length - 1);
  const selected = Math.min(
    selection.cursor,
    Math.max(0, pageResults.length - 1),
  );
  const hostIds = markedHostIds(pageResults, selection.marks);
  const picked = pickedHosts({ ...selection, cursor: selected }, pageResults);
  useEffect(() => {
    document
      .querySelector("[data-launch-selected]")
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, menuSelected, open]);
  // cmdk marks only its one highlighted item as aria-selected, and rewrites it after our
  // effect when the cursor moves; mirror the multi-selection once that render is done.
  useEffect(() => {
    queueMicrotask(() =>
      pageRef.current
        ?.querySelectorAll("[cmdk-item]")
        .forEach((item, index) =>
          item.setAttribute(
            "aria-selected",
            String(
              !!pageResults[index] &&
                isSelected(
                  { ...selection, cursor: selected },
                  pageResults,
                  index,
                ),
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
    setOpen(false);
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
    setOpen(false);
    setSelection((current) => clickRow(current, pageResults, index, mode));
  };
  const row = (result: LauncherResult, index: number) => (
    <LauncherRow
      key={result.key}
      result={result}
      cursor={!open && selected === index}
      selected={isSelected(
        { ...selection, cursor: selected },
        pageResults,
        index,
      )}
      armed={!!result.workspace && armed === result.workspace.id}
      busy={busy}
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
  const pageKeys = launcherKeyHandler({
    results: pageResults,
    selected,
    marked: selection.marks.length > 0,
    unmark: () => setSelection((current) => ({ ...current, marks: [] })),
    busy,
    target: null,
    forcedTarget: null,
    activate,
    select: (index) => setSelection(collapsed(index, true)),
    clear: () => {
      setQuery("");
      setSelection(collapsed());
    },
    onConnect,
    onQuickConnect,
  });
  const menuKeys = launcherKeyHandler({
    results: menuRows,
    selected: menuSelected,
    marked: false,
    unmark: () => {},
    busy,
    target: shown,
    forcedTarget,
    activate,
    select: setMenuCursor,
    clear: () => setOpen(false),
    onConnect,
    onQuickConnect,
  });
  const listed = menuRows.some((r) => r.group !== "quick");
  const empty =
    listed || shown
      ? null
      : emptyMessage({
          jump,
          text: menu.text,
          hasTarget: !!shown,
          invalid,
          nothingSaved: !hosts.length && !tabs.length,
        });
  const currentKey = open
    ? menuRows[menuSelected] && `menu-${menuRows[menuSelected].key}`
    : pageResults[selected]?.key;
  return (
    <section
      className="mx-auto min-h-0 w-full max-w-[760px] flex-1 overflow-auto px-[24px] pt-[40px] pb-[56px]"
      aria-label={
        jump
          ? t("settings.shortcuts.goToTab")
          : t("terminal.connectionLauncher.newTab")
      }
    >
      <Command
        shouldFilter={false}
        label={t("terminal.connectionLauncher.searchHostsOrTabs")}
        value={currentKey ?? ""}
        disablePointerSelection
        onValueChange={(key) => {
          const index = pageResults.findIndex((result) => result.key === key);
          if (!open && index >= 0 && !clicking.current)
            setSelection((current) => ({ ...current, cursor: index }));
        }}
        className="h-auto overflow-visible rounded-none! bg-transparent p-0 text-inherit"
      >
        <div ref={searchRef} className="relative">
          <LauncherSearch
            value={query}
            shortcut={shortcut}
            placeholder={
              jump
                ? t("settings.shortcuts.goToTab")
                : t("terminal.connectionLauncher.searchHostsOrTabs2")
            }
            onChange={(value) => {
              setQuery(value);
              setOpen(true);
              setMenuCursor(0);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={open ? menuKeys : pageKeys}
          />
          {open && (
            <SearchMenu
              results={menuRows}
              cursor={menuSelected}
              jump={jump}
              jumpShortcut={jumpShortcut}
              empty={empty}
              busy={busy}
              onJump={() => {
                setJump((current) => !current);
                setMenuCursor(0);
              }}
              onActivate={activate}
            />
          )}
        </div>
        <div ref={pageRef}>
          <LauncherList
            label={t("terminal.connectionLauncher.availableConnections")}
            multiselectable
            groups={groupResults(pageResults, { text: "", hasRecent })}
            empty={
              pageResults.length
                ? null
                : t("terminal.connectionLauncher.noSavedHosts")
            }
            renderRow={row}
            renderHeading={({ id, heading }) =>
              id === "hosts" && (
                <LauncherActions
                  heading={heading}
                  busy={busy}
                  canCreate={hostIds.length >= 2}
                  restoring={picked.length}
                  onCreate={() => {
                    onCreateWorkspace(hostIds);
                    setSelection(collapsed(selected));
                  }}
                  onRestore={() => {
                    onRestore(picked);
                    setSelection(collapsed(selected));
                  }}
                />
              )
            }
          />
        </div>
      </Command>
    </section>
  );
}
