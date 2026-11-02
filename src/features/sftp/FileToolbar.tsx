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
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { SelectField } from "@/components/SelectField";
import { IconButton } from "@/components/IconButton";
import { WithTooltip } from "@/components/WithTooltip";
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
  setHidden: (value: boolean) => void;
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
  ) => (
    <IconButton label={label} disabled={disabled || !run} onClick={run}>
      {icon}
    </IconButton>
  );

  return (
    <>
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
        <Separator
          orientation="vertical"
          className="mx-1 my-auto h-4 self-auto"
        />
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
        <WithTooltip label={t("sftp.hidden")}>
          <Toggle
            size="sm"
            className="min-w-7 px-0 text-muted-foreground aria-pressed:text-foreground"
            aria-label={t("sftp.hidden")}
            pressed={hidden}
            disabled={disabled}
            onPressedChange={setHidden}
          >
            <Eye size={14} />
          </Toggle>
        </WithTooltip>
        <SelectField
          className="ml-auto h-7 max-w-32 text-xs"
          aria-label={t("sftp.roots")}
          placeholder={t("sftp.roots")}
          value=""
          disabled={disabled}
          onValueChange={(root) => void browser.navigate(root)}
          options={(browser.directory?.roots ?? []).map((root) => ({
            value: root,
            label: root,
          }))}
        />
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
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled}
              className="px-1 font-normal text-inherit"
              onClick={() => void browser.navigate(part.path)}
            >
              {part.label}
            </Button>
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
