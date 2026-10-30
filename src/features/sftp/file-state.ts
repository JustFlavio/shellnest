import type {
  Directory,
  FileEntry,
  Transfer,
  TransferProgress,
} from "./types.ts";

export function visibleEntries(
  directory: Directory | null,
  hidden: boolean,
  query: string,
): FileEntry[] {
  const needle = query.toLocaleLowerCase();
  return (directory?.entries ?? [])
    .filter(
      (e) =>
        (hidden || !e.hidden) && e.name.toLocaleLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        Number(b.kind === "directory") - Number(a.kind === "directory") ||
        a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
}
export function selectEntry(
  entries: FileEntry[],
  selected: Set<string>,
  path: string,
  anchor: string | null,
  additive: boolean,
  range: boolean,
): Set<string> {
  const start = entries.findIndex((e) => e.path === anchor),
    end = entries.findIndex((e) => e.path === path);
  if (range && start >= 0 && end >= 0)
    return new Set([
      ...(additive ? selected : []),
      ...entries
        .slice(Math.min(start, end), Math.max(start, end) + 1)
        .map((e) => e.path),
    ]);
  if (!additive) return new Set([path]);
  const next = new Set(selected);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}
export function transferProgress(
  queue: Transfer[],
  progress: TransferProgress,
): Transfer[] {
  return queue.map((item) =>
    item.id === progress.id ? { ...item, ...progress } : item,
  );
}
export function breadcrumbs(path: string): { label: string; path: string }[] {
  const separator = path.includes("\\") ? "\\" : "/";
  const parts = path.split(separator).filter(Boolean);
  const prefix = path.startsWith("\\\\")
    ? "\\\\"
    : path.startsWith("/")
      ? "/"
      : "";
  const result = prefix === "/" ? [{ label: "/", path: "/" }] : [];
  parts.forEach((label, index) =>
    result.push({
      label,
      path:
        prefix +
        parts.slice(0, index + 1).join(separator) +
        (index === 0 && label.endsWith(":") ? separator : ""),
    }),
  );
  return result;
}
export function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const exp = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4);
  return `${(value / 1024 ** exp).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${["B", "KiB", "MiB", "GiB", "TiB"][exp]}`;
}
