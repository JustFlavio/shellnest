import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Pencil, Trash2, Copy, UserRound } from "lucide-react";
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
  return (
    <>
      <DropdownMenuItem disabled={busy} onClick={() => actions.onConnect(h)}>
        <ChevronRight size={14} />
        Connetti
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        role="menuitem"
        aria-label={`Modifica ${h.name}`}
        disabled={busy}
        onClick={() => actions.onEdit(h)}
      >
        <Pencil size={13} />
        Modifica
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={busy}
        onClick={() => actions.onDuplicate(h)}
      >
        <Copy size={13} />
        Duplica host
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={busy}
        onClick={() => actions.onAssign(h)}
      >
        <UserRound size={13} />
        Assegna identità
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        onClick={() =>
          void navigator.clipboard
            .writeText(h.address)
            .catch((e) => actions.onError(String(e)))
        }
      >
        <Copy size={13} />
        Copia indirizzo
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={busy}
        variant="destructive"
        onClick={() => actions.onDelete(h)}
      >
        <Trash2 size={13} />
        Elimina host
      </DropdownMenuItem>
    </>
  );
}
