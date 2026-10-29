import { useTranslation } from "react-i18next";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Pencil, Trash2, Copy, UserRound } from "lucide-react";
import { notifyError } from "@/lib/notify";
import type { Host } from "@/lib/types";
import type { HostActions } from "./host-interaction";

export function HostMenuItems({
  host: h,
  busy,
  actions,
}: {
  host: Host;
  busy: boolean;
  actions: HostActions;
}) {
  const { t } = useTranslation();
  return (
    <>
      <DropdownMenuItem disabled={busy} onClick={() => actions.onConnect(h)}>
        <ChevronRight size={14} />
        {t("hosts.hostEditor.connect")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        role="menuitem"
        aria-label={t("hosts.collectionTables.editName", { name: h.name })}
        disabled={busy}
        onClick={() => actions.onEdit(h)}
      >
        <Pencil size={13} />
        {t("hosts.hostEditButton.edit")}
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={busy}
        onClick={() => actions.onDuplicate(h)}
      >
        <Copy size={13} />
        {t("hosts.hostMenuItems.duplicateHost")}
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={busy}
        onClick={() => actions.onAssign(h)}
      >
        <UserRound size={13} />
        {t("hosts.bulkAssignDialog.assignIdentity")}
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        onClick={() =>
          void navigator.clipboard
            .writeText(h.address)
            .catch((e) => notifyError(t("hosts.hostMenuItems.copyFailed"), e))
        }
      >
        <Copy size={13} />
        {t("hosts.hostMenuItems.copyAddress")}
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={busy}
        variant="destructive"
        onClick={() => actions.onDelete(h)}
      >
        <Trash2 size={13} />
        {t("hosts.deletionDialog.deleteHost")}
      </DropdownMenuItem>
    </>
  );
}
