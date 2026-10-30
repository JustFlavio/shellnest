import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  FolderPlus,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { breadcrumbs } from "./file-state.ts";
import type { FileBrowser } from "./useFileBrowser";
import type { FileAction } from "./FileActionsDialog";
export function FileToolbar({
  browser,
  ready,
  hidden,
  setHidden,
  query,
  setQuery,
  selectedCount,
  setAction,
}: {
  browser: FileBrowser;
  ready: boolean;
  hidden: boolean;
  setHidden: (value: boolean | ((old: boolean) => boolean)) => void;
  query: string;
  setQuery: (value: string) => void;
  selectedCount: number;
  setAction: (value: FileAction) => void;
}) {
  const { t } = useTranslation();
  const disabled = !ready || browser.loading;
  const iconButton = (
    label: string,
    icon: React.ReactNode,
    run: (() => void) | undefined,
    pressed?: boolean,
  ) => (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled || !run}
      onClick={run}
    >
      {icon}
    </Button>
  );

  return (
    <>
      {" "}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        {iconButton(t("sftp.back"), <ArrowLeft size={14} />, browser.back)}
        {iconButton(
          t("sftp.forward"),
          <ArrowRight size={14} />,
          browser.forward,
        )}
        {iconButton(
          t("sftp.up"),
          <ArrowUp size={14} />,
          browser.directory?.parent
            ? () => void browser.navigate(browser.directory!.parent!)
            : undefined,
        )}
        {iconButton(
          t("sftp.refresh"),
          <RefreshCw
            size={14}
            className={browser.loading ? "animate-spin" : undefined}
          />,
          () => void browser.refresh(),
        )}
        <span className="mx-1 h-4 border-l border-border" />
        {iconButton(t("sftp.mkdir"), <FolderPlus size={14} />, () =>
          setAction("mkdir"),
        )}
        {iconButton(
          t("sftp.rename"),
          <Pencil size={14} />,
          selectedCount === 1 ? () => setAction("rename") : undefined,
        )}
        {iconButton(
          t("sftp.delete"),
          <Trash2 size={14} />,
          selectedCount ? () => setAction("delete") : undefined,
        )}
        {iconButton(
          t("sftp.hidden"),
          <Eye size={14} />,
          () => setHidden((v) => !v),
          hidden,
        )}
        <select
          className="ml-auto max-w-24 rounded border border-border bg-background p-1 text-xs"
          aria-label={t("sftp.roots")}
          value=""
          disabled={disabled}
          onChange={(e) => void browser.navigate(e.target.value)}
        >
          <option value="">{t("sftp.roots")}</option>
          {browser.directory?.roots.map((root) => (
            <option key={root} value={root}>
              {root}
            </option>
          ))}
        </select>
      </div>
      <form
        key={browser.directory?.path ?? ""}
        className="px-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("path");
          if (typeof value === "string") void browser.navigate(value);
        }}
      >
        <Input
          name="path"
          aria-label={t("sftp.path")}
          className="h-8 font-mono text-xs"
          defaultValue={browser.directory?.path ?? ""}
          disabled={!ready}
        />
      </form>
      <nav
        aria-label={t("sftp.breadcrumbs")}
        className="flex shrink-0 items-center gap-1 overflow-x-auto px-3 py-1 text-xs text-muted-foreground"
      >
        {breadcrumbs(browser.directory?.path ?? "").map((part, i) => (
          <span key={part.path} className="flex shrink-0 items-center gap-1">
            {i > 0 && part.path !== `/${part.label}` && <span>/</span>}
            <button
              type="button"
              disabled={disabled}
              className="rounded px-1 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => void browser.navigate(part.path)}
            >
              {part.label}
            </button>
          </span>
        ))}
      </nav>
      <div className="px-3 pb-2">
        <Input
          className="h-7 text-xs"
          type="search"
          aria-label={t("sftp.filter")}
          placeholder={t("sftp.filter")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    </>
  );
}
