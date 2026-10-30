import { useEffect } from "react";
import { mac } from "@/lib/platform";
import {
  DEFAULT_FONT_SIZE,
  clampFontSize,
} from "@/features/settings/settings.ts";
import { actionFor } from "@/features/settings/shortcuts.ts";
import { terminalHandles } from "@/features/terminal/terminal-handles";
import type { AppState } from "./useAppState";
import { useLatest } from "@/lib/useLatest";
import { leafIds } from "@/features/terminal/workbench-state.ts";

/** Global keyboard shortcuts; they stand down while a dialog or editor is open. */
export function useShortcuts(app: AppState) {
  const latest = useLatest(app);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const {
        vault,
        preferences,
        closeGuard,
        tabs,
        library,
        settings,
        session,
      } = latest.current;
      if (
        document.body.classList.contains("dialog-open") ||
        document.body.classList.contains("alert-open") ||
        !vault.view.unlocked ||
        vault.busyRef.current ||
        library.hostForm ||
        library.identityForm ||
        library.keyForm ||
        settings.section ||
        library.bulkOpen ||
        library.deletion ||
        (tabs.trust && !tabs.trust.tabId) ||
        session.vaultDialog ||
        session.pendingSwitch ||
        tabs.pendingClose ||
        closeGuard.open ||
        session.pendingLock
      )
        return;
      const { active, setActive, focusOf } = tabs;
      const action = actionFor(e, mac, preferences.bindings);
      if (!action) {
        if (e.key === "Escape" && active === "vault") library.clearSelection();
        return;
      }
      const leader = tabs.tabs.find((t) => t.id === active);
      const order = tabs.bar,
        items = [
          "vault",
          ...order.map((t) => t.id),
          ...(tabs.launcherOpen ? ["launcher"] : []),
        ];
      const cycle = (step: number) => {
        const at = Math.max(0, items.indexOf(active));
        setActive(items[(at + step + items.length) % items.length]);
      };
      const stepPane = (step: number) => {
        if (!leader?.layout) return false;
        const ids = leafIds(leader.layout);
        tabs.setFocusedPane(
          ids[(ids.indexOf(focusOf(leader)) + step + ids.length) % ids.length],
        );
        return true;
      };
      const moveTab = (step: number) => {
        const to = leader && order[order.indexOf(leader) + step];
        if (leader && to) tabs.reorder(leader.id, to.id);
        return !!leader;
      };
      const { appSettings, saveSettings } = preferences;
      const zoom = (to: number) =>
        saveSettings({ ...appSettings, fontSize: clampFontSize(to) });
      const handled: Record<string, () => boolean | void> = {
        toggleFiles: () => {
          const pane =
            leader && tabs.tabs.find((tab) => tab.id === focusOf(leader));
          if (!pane || pane.kind === "local") return false;
          tabs.setPaneView(
            pane.id,
            pane.view === "files" ? "terminal" : "files",
          );
        },
        quickConnect: tabs.openLauncher,
        newLocal: tabs.openLocal,
        jumpTab: tabs.openJump,
        newHost: () => library.newHostIn(""),
        newFolder: () => {
          setActive("vault");
          library.newFolder();
        },
        searchVault: () => {
          setActive("vault");
          requestAnimationFrame(() => library.search.current?.focus());
        },
        lockVault: session.requestLock,
        openSettings: () => settings.open(),
        closePane: () =>
          active === "launcher"
            ? tabs.closeLauncher()
            : leader && tabs.askClosePane(focusOf(leader)),
        closeWorkspace: () => leader && tabs.askCloseTab(leader.id),
        reopenTab: tabs.reopenTab,
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
        splitRight: () => leader && tabs.splitTab(leader.id, "row"),
        splitDown: () => leader && tabs.splitTab(leader.id, "col"),
        prevPane: () => stepPane(-1),
        nextPane: () => stepPane(1),
        // Only on a split tab: elsewhere Ctrl+B goes to the shell (tmux, readline).
        broadcast: () => {
          if (!leader?.layout) return false;
          tabs.toggleBroadcast(leader.id);
        },
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
  }, [latest]);
}
