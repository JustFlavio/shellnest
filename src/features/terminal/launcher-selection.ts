import { MAX_WORKSPACE_HOSTS } from "./launcher-results.ts";
import type { LauncherResult } from "./launcher-results.ts";

// `cursor` is the row Enter opens, `anchor` where a Shift+click range starts. `marks` are the
// keys of the host rows picked together; empty means only the cursor row is selected. `chosen`
// tells a row the user picked from the one the list highlights on its own.
export type Selection = {
  cursor: number;
  anchor: number;
  marks: string[];
  chosen: boolean;
};
export type ClickMode = "single" | "toggle" | "range";

export const collapsed = (cursor = 0, chosen = false): Selection => ({
  cursor,
  anchor: cursor,
  marks: [],
  chosen,
});

const isHost = (result: LauncherResult | undefined) => result?.kind === "host";

// The new selection after a click on row `index`. Only saved-host rows join a multi-selection;
// any other row falls back to a plain click. A range or toggle keeps the cursor on a marked row.
export function clickRow(
  selection: Selection,
  results: LauncherResult[],
  index: number,
  mode: ClickMode,
): Selection {
  const row = results[index];
  if (!row) return selection;
  if (mode === "single" || !isHost(row)) return collapsed(index, true);
  if (mode === "range") {
    const from = Math.min(selection.anchor, results.length - 1);
    const step = index >= from ? 1 : -1;
    const keys: string[] = [];
    for (let i = from; i !== index + step; i += step)
      if (isHost(results[i])) keys.push(results[i].key);
    const marks = keys.slice(0, MAX_WORKSPACE_HOSTS);
    const cursor = results.findIndex((r) => r.key === marks[marks.length - 1]);
    return { cursor, anchor: selection.anchor, marks, chosen: true };
  }
  const current = results[selection.cursor];
  const base =
    selection.marks.length || !isHost(current)
      ? selection.marks
      : [current.key];
  if (!base.includes(row.key)) {
    if (base.length >= MAX_WORKSPACE_HOSTS) return selection;
    return {
      cursor: index,
      anchor: index,
      marks: [...base, row.key],
      chosen: true,
    };
  }
  const marks = base.filter((key) => key !== row.key);
  const cursor = marks.length
    ? selection.cursor === index
      ? results.findIndex((r) => r.key === marks[marks.length - 1])
      : selection.cursor
    : index;
  return { cursor, anchor: cursor, marks, chosen: true };
}

// Whether a row shows as selected: the marked rows, or just the cursor row once it is chosen.
export const isSelected = (
  { cursor, marks, chosen }: Selection,
  results: LauncherResult[],
  index: number,
) =>
  marks.length
    ? marks.includes(results[index].key)
    : chosen && cursor === index;

// The saved hosts the selection stands for, in list order.
export const pickedHosts = (
  selection: Selection,
  results: LauncherResult[],
): NonNullable<LauncherResult["host"]>[] =>
  results.flatMap((r, i) =>
    r.kind === "host" && r.host && isSelected(selection, results, i)
      ? [r.host]
      : [],
  );

export const markedHostIds = (
  results: LauncherResult[],
  marks: string[],
): string[] =>
  results.flatMap((r) => (r.host && marks.includes(r.key) ? [r.host.id] : []));
