import type { MouseEvent } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KeyRound, LockKeyhole, UserRound } from "lucide-react";
import { OsIcon } from "@/components/OsIcon";
import { ActionMenu } from "@/components/ActionMenu";
import type { Host, Identity } from "@/lib/types";
import { endpoint, hostKeyDown } from "./host-interaction";
import type { HostActions } from "./host-interaction";
import { HostEditButton } from "./HostEditButton";
import { HostMenuItems } from "./HostMenuItems";

export function HostRow({
  host: h,
  identity: i,
  selected,
  busy,
  actions,
  onSelect,
  onEditIdentity,
}: {
  host: Host;
  identity: Identity | undefined;
  selected: boolean;
  busy: boolean;
  actions: HostActions;
  onSelect: (host: Host, e: Pick<MouseEvent, "ctrlKey" | "metaKey">) => void;
  onEditIdentity: (identity: Identity) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<tr />}
        data-selection-id={h.id}
        className={cn("group", selected && "checked")}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) onSelect(h, e);
        }}
        onDoubleClick={(e) => {
          if (!busy && !(e.target as HTMLElement).closest("button"))
            actions.onConnect(h);
        }}
      >
        <td>
          <Button
            variant="ghost"
            className="h-auto justify-start gap-[10px] p-0 text-[13px] text-foreground"
            disabled={busy}
            aria-label={"Seleziona " + h.name}
            aria-pressed={selected}
            onClick={(e) => onSelect(h, e)}
            onDoubleClick={() => {
              if (!busy) actions.onConnect(h);
            }}
            onKeyDown={(e) =>
              hostKeyDown(h, e, busy, actions.onConnect, onSelect)
            }
          >
            <OsIcon os={h.os} size="row" />
            {h.name}
          </Button>
        </td>
        <td className="font-mono">{endpoint(h)}</td>
        <td>
          {i ? (
            <Button
              variant="ghost"
              className="h-auto justify-start gap-[7px] px-0 py-[3px] text-left text-muted-foreground hover:bg-transparent hover:text-foreground disabled:opacity-100"
              disabled={busy}
              onClick={() => onEditIdentity(i)}
            >
              {i.auth === "key" ? (
                <KeyRound size={13} />
              ) : (
                <LockKeyhole size={13} />
              )}
              <span>
                {i.name}
                <small className="text-[12px]"> · {i.username}</small>
              </span>
            </Button>
          ) : h.username ? (
            <span className="inline-flex items-center gap-[6px]">
              <UserRound size={14} />
              {h.username}
              <span className="text-muted-foreground">· host</span>
            </span>
          ) : (
            <span className="text-destructive">Identità mancante</span>
          )}
        </td>
        <td>
          <div className="flex items-center justify-end gap-[3px] [&_button]:size-[28px] [&_button]:p-0 [&_button]:text-muted-foreground">
            <HostEditButton host={h} busy={busy} onEdit={actions.onEdit} />
            <ActionMenu label={"Azioni " + h.name}>
              <HostMenuItems host={h} busy={busy} actions={actions} />
            </ActionMenu>
          </div>
        </td>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-[230px]"
        aria-label={"Azioni " + h.name}
      >
        <HostMenuItems host={h} busy={busy} actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
