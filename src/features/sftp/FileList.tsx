import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Folder, File, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { bytes, selectEntry } from "./file-state.ts";
import type { FileBrowser } from "./useFileBrowser";
import type { FileEntry, Side } from "./types";
export const FILE_DRAG_TYPE = "application/x-shellnest-files";
export function FileList({
  browser,
  ready,
  entries,
  query,
  sessionKey,
  side,
}: {
  browser: FileBrowser;
  ready: boolean;
  entries: FileEntry[];
  query: string;
  sessionKey: string;
  side: Side;
}) {
  const { t } = useTranslation();
  const disabled = !ready || browser.loading;
  const anchor = useRef<string | null>(null);
  const selected = entries.filter((e) => browser.selected.has(e.path));
  const select = (
    entry: FileEntry,
    e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => {
    browser.setSelected(
      selectEntry(
        entries,
        browser.selected,
        entry.path,
        anchor.current,
        e.ctrlKey || e.metaKey,
        e.shiftKey,
      ),
    );
    if (!e.shiftKey) anchor.current = entry.path;
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto" aria-busy={browser.loading}>
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-card text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-2">
              <input
                type="checkbox"
                aria-label={t("sftp.selectAll")}
                checked={
                  entries.length > 0 &&
                  entries.every((e) => browser.selected.has(e.path))
                }
                disabled={disabled || !entries.length}
                onChange={(e) =>
                  browser.setSelected(
                    new Set(e.target.checked ? entries.map((x) => x.path) : []),
                  )
                }
              />
            </th>
            <th className="py-2 font-normal">{t("sftp.name")}</th>
            <th className="px-2 py-2 text-right font-normal">
              {t("sftp.size")}
            </th>
            <th className="px-2 py-2 font-normal">{t("sftp.modified")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.path}
              aria-selected={browser.selected.has(entry.path)}
              className={cn(
                "border-b border-border/40 hover:bg-muted/40",
                browser.selected.has(entry.path) && "bg-primary/10",
              )}
            >
              <td className="px-2">
                <input
                  type="checkbox"
                  checked={browser.selected.has(entry.path)}
                  aria-label={t("sftp.selectName", { name: entry.name })}
                  disabled={disabled}
                  onChange={() =>
                    browser.setSelected(
                      selectEntry(
                        entries,
                        browser.selected,
                        entry.path,
                        null,
                        true,
                        false,
                      ),
                    )
                  }
                />
              </td>
              <td className="max-w-0">
                <button
                  type="button"
                  data-file-entry
                  className="flex w-full items-center gap-2 rounded py-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
                  disabled={disabled}
                  draggable={!disabled}
                  onDragStart={(e) => {
                    const paths = browser.selected.has(entry.path)
                      ? selected.map((x) => x.path)
                      : [entry.path];
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setData(
                      FILE_DRAG_TYPE,
                      JSON.stringify({ sessionKey, side, paths }),
                    );
                  }}
                  onClick={(e) => select(entry, e)}
                  onDoubleClick={() => {
                    if (entry.kind === "directory" || entry.kind === "symlink")
                      void browser.navigate(entry.path);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      ["directory", "symlink"].includes(entry.kind)
                    ) {
                      e.preventDefault();
                      void browser.navigate(entry.path);
                    }
                    if (
                      (e.ctrlKey || e.metaKey) &&
                      e.key.toLowerCase() === "a"
                    ) {
                      e.preventDefault();
                      browser.setSelected(new Set(entries.map((x) => x.path)));
                    }
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const index = entries.indexOf(entry),
                        next =
                          entries[index + (e.key === "ArrowDown" ? 1 : -1)];
                      if (next) {
                        if (e.shiftKey) select(next, e);
                        const buttons = e.currentTarget
                          .closest("table")
                          ?.querySelectorAll<HTMLButtonElement>(
                            "[data-file-entry]",
                          );
                        buttons?.[entries.indexOf(next)]?.focus();
                      }
                    }
                  }}
                >
                  {entry.kind === "directory" ? (
                    <Folder size={16} className="shrink-0 text-primary" />
                  ) : entry.kind === "symlink" ? (
                    <Link
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <File
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="truncate" title={entry.name}>
                    {entry.name}
                  </span>
                </button>
              </td>
              <td className="px-2 text-right whitespace-nowrap text-muted-foreground">
                {entry.size === null ? "—" : bytes(entry.size)}
              </td>
              <td className="px-2 whitespace-nowrap text-muted-foreground">
                {entry.modified === null
                  ? "—"
                  : new Date(entry.modified * 1000).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {ready && !browser.loading && !entries.length && (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {t(query ? "sftp.noMatches" : "sftp.empty")}
        </p>
      )}
      {browser.loading && !browser.directory && (
        <p
          role="status"
          className="p-6 text-center text-sm text-muted-foreground"
        >
          {t("sftp.loading")}
        </p>
      )}
    </div>
  );
}
