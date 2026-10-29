import { useTranslation } from "react-i18next";
import type { MouseEvent } from "react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/ActionMenu";
import type { Group } from "@/lib/types";

export function FolderCard({
  folder: g,
  layout,
  hostCount,
  subfolderCount,
  selected,
  busy,
  onSelect,
  onOpen,
  onEdit,
  onNewGroup,
  onDelete,
}: {
  folder: Group;
  layout: "list" | "cards";
  hostCount: number;
  subfolderCount: number;
  selected: boolean;
  busy: boolean;
  onSelect: (id: string, e: Pick<MouseEvent, "ctrlKey" | "metaKey">) => void;
  onOpen: (id: string) => void;
  onEdit: (group: Group) => void;
  onNewGroup: (parentId: string) => void;
  onDelete: (group: Group) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="group relative min-w-0 animate-[rise_0.28s_cubic-bezier(0.2,0.7,0.2,1)_backwards]">
      <Button
        variant="ghost"
        className={cn(
          "flex w-full min-w-0 justify-start gap-[12px] rounded-xl border border-transparent bg-card px-[10px] text-left hover:bg-accent aria-pressed:border-primary",
          layout === "cards" ? "h-[64px] py-[9px]" : "h-[48px] py-[5px]",
        )}
        data-selection-id={g.id}
        data-selection-kind="folder"
        aria-label={t("hosts.folderCard.selectFolder", { name: g.name })}
        aria-pressed={selected}
        disabled={busy}
        onClick={(e) => onSelect(g.id, e)}
        onDoubleClick={() => {
          if (!busy) onOpen(g.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!busy) onOpen(g.id);
          }
          if (e.key === " ") {
            e.preventDefault();
            onSelect(g.id, e);
          }
        }}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-[11px] bg-accent text-primary",
            layout === "cards" ? "size-[44px]" : "size-[36px]",
          )}
        >
          <Folder className="size-[24px]" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{g.name}</strong>
          <small className="mt-[3px] block truncate text-[11px] font-normal text-muted-foreground">
            {hostCount} host
            {subfolderCount > 0 &&
              ` · ${subfolderCount} ${subfolderCount === 1 ? "sottogruppo" : "sottogruppi"}`}
          </small>
        </span>
      </Button>
      <ActionMenu
        label={t("hosts.folderCard.folderActions", { name: g.name })}
        className="absolute inset-y-0 right-[10px] my-auto opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100"
      >
        <DropdownMenuItem disabled={busy} onClick={() => onOpen(g.id)}>
          <Folder size={13} />
          {t("hosts.folderCard.open")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={() => onEdit(g)}>
          <Pencil size={13} />
          {t("hosts.folderCard.editGroup")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={() => onNewGroup(g.id)}>
          <FolderPlus size={13} />
          {t("hosts.folderCard.newSubgroup")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={busy}
          onClick={() => onDelete(g)}
        >
          <Trash2 size={13} />
          {t("hosts.deletionDialog.deleteGroup")}
        </DropdownMenuItem>
      </ActionMenu>
    </div>
  );
}
