import type { ConnectionTarget } from "./connection-target.ts";
import { launcherKeyAction } from "./launcher-results.ts";
import type { LauncherResult, RecentHost } from "./launcher-results.ts";

type KeyEvent = Pick<
  React.KeyboardEvent,
  "key" | "shiftKey" | "metaKey" | "ctrlKey" | "preventDefault"
>;

// Key handler of the search box: moves the selection across the groups, opens a result,
// Shift+Enter starts a new session of an open host, Cmd/Ctrl+Enter quick-connects, Escape
// drops a multi-selection before it clears the search.
export function launcherKeyHandler({
  results,
  selected,
  marked,
  busy,

  target,
  forcedTarget,
  activate,
  select,
  clear,
  unmark,
  onConnect,
  onQuickConnect,
}: {
  results: LauncherResult[];
  selected: number;
  marked: boolean;
  // drops the multi-selection, keeping the cursor row
  unmark: () => void;
  busy: boolean;
  target: ConnectionTarget | null;
  // any text that parses as an address, for Cmd/Ctrl+Enter
  forcedTarget: ConnectionTarget | null;
  activate: (result: LauncherResult) => void;
  select: (index: number) => void;
  clear: () => void;
  onConnect: (host: RecentHost) => void;
  onQuickConnect: (target: ConnectionTarget) => void;
}) {
  return (event: KeyEvent) => {
    const current = results[selected];
    const modified = event.metaKey || event.ctrlKey;
    if (event.key === "Enter" && event.shiftKey && current?.openTab && !busy) {
      event.preventDefault();
      onConnect(current.host!);
      return;
    }
    if (event.key === "Escape" && marked) {
      event.preventDefault();
      return unmark();
    }
    const quick = modified ? forcedTarget : target;
    const action = launcherKeyAction(event.key, {
      count: results.length,
      selected,
      busy,
      canQuickConnect: !busy && !!quick,
      modified,
    });
    if (!action) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    if (action.type === "clear") return clear();
    event.preventDefault();
    if (action.type === "select") select(action.index);
    else if (action.type === "activate") activate(current);
    else onQuickConnect(quick!);
  };
}
