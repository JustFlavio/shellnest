import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { visibleEntries } from "./file-state.ts";
import { FileActionsDialog } from "./FileActionsDialog";
import type { FileAction } from "./FileActionsDialog";
import { FileToolbar } from "./FileToolbar";
import { FileList, FILE_DRAG_TYPE } from "./FileList";
import type { FileBrowser } from "./useFileBrowser";
import type { FileEntry, Side } from "./types";
export function FilePane({
  side,
  title,
  browser,
  sessionKey,
  ready,
  onTransfer,
  onDrop,
}: {
  side: Side;
  title: string;
  browser: FileBrowser;
  sessionKey: string;
  ready: boolean;
  onTransfer: (entries: FileEntry[]) => void;
  onDrop: (side: Side, paths: string[]) => void;
}) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false),
    [query, setQuery] = useState("");
  const [action, setAction] = useState<FileAction | null>(null),
    [dropping, setDropping] = useState(false);
  const entries = visibleEntries(browser.directory, hidden, query);
  const selected = entries.filter((e) => browser.selected.has(e.path));
  const disabled = !ready || browser.loading;
  return (
    <section
      aria-label={title}
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden bg-card/20",
        dropping && "ring-2 ring-inset ring-primary",
      )}
      onDragOver={(e) => {
        if (ready && e.dataTransfer.types.includes(FILE_DRAG_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropping(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        const data: unknown = (() => {
          try {
            return JSON.parse(e.dataTransfer.getData(FILE_DRAG_TYPE));
          } catch {
            return null;
          }
        })();
        if (!data || typeof data !== "object") return;
        const payload = data as Record<string, unknown>;
        if (
          payload.sessionKey !== sessionKey ||
          payload.side === side ||
          !Array.isArray(payload.paths) ||
          !payload.paths.every((p): p is string => typeof p === "string")
        )
          return;
        if (payload.side !== "local" && payload.side !== "remote") return;
        e.preventDefault();
        onDrop(payload.side, payload.paths);
      }}
    >
      <header className="flex min-h-11 items-center justify-between gap-2 border-b border-border px-3">
        <h2 className="truncate text-sm font-medium">{title}</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !selected.length}
          onClick={() => onTransfer(selected)}
        >
          {side === "local" ? <Upload size={14} /> : <Download size={14} />}
          {t(side === "local" ? "sftp.upload" : "sftp.download")}
        </Button>
      </header>
      <FileToolbar
        browser={browser}
        ready={ready}
        hidden={hidden}
        setHidden={setHidden}
        query={query}
        setQuery={setQuery}
        selectedCount={selected.length}
        setAction={setAction}
      />
      {browser.error && (
        <p role="alert" className="px-3 py-2 text-xs text-destructive">
          {browser.error}
        </p>
      )}
      <FileList
        browser={browser}
        ready={ready}
        entries={entries}
        query={query}
        sessionKey={sessionKey}
        side={side}
      />
      <div className="shrink-0 border-t border-border px-3 py-1 text-xs text-muted-foreground">
        {t("sftp.selection", {
          selected: selected.length,
          count: entries.length,
        })}
      </div>
      {action && (
        <FileActionsDialog
          action={action}
          browser={browser}
          entries={selected}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  );
}
