import { useTranslation } from "react-i18next";
import type { MouseEvent } from "react";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OsIcon } from "@/components/OsIcon";
import type { Host, Identity } from "@/lib/types";
import { endpoint, hostKeyDown } from "./host-interaction";
import type { HostActions } from "./host-interaction";
import { HostEditButton } from "./HostEditButton";
import { HostMenuItems } from "./HostMenuItems";

export function HostCard({
  host: h,
  identity: i,
  index,
  selected,
  editing,
  busy,
  actions,
  onSelect,
}: {
  host: Host;
  identity: Identity | undefined;
  index: number;
  selected: boolean;
  editing: boolean;
  busy: boolean;
  actions: HostActions;
  onSelect: (host: Host, e: Pick<MouseEvent, "ctrlKey" | "metaKey">) => void;
}) {
  const { t } = useTranslation();
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Card
            data-selection-id={h.id}
            style={{ animationDelay: `${Math.min(index, 4) * 30}ms` }}
            className={cn(
              "group relative h-[64px] min-w-0 flex-row items-center gap-0 border border-transparent p-0 shadow-none ring-0 animate-[rise_0.28s_cubic-bezier(0.2,0.7,0.2,1)_backwards] transition hover:-translate-y-px hover:border-input hover:bg-accent focus-within:border-input focus-within:bg-accent",
              (selected || editing) &&
                "border-primary bg-card hover:border-primary hover:bg-card focus-within:border-primary focus-within:bg-card",
            )}
          />
        }
      >
        <Button
          variant="ghost"
          className="h-full w-full min-w-0 justify-start gap-[10px] rounded-[11px] py-[9px] pr-[46px] pl-[10px] text-left hover:bg-transparent"
          disabled={busy}
          aria-label={t("hosts.hostCard.selectName", { name: h.name })}
          aria-pressed={selected}
          onClick={(e) => onSelect(h, e)}
          onDoubleClick={() => {
            if (!busy) actions.onConnect(h);
          }}
          onKeyDown={(e) =>
            hostKeyDown(h, e, busy, actions.onConnect, onSelect)
          }
          title={endpoint(h)}
        >
          <OsIcon os={h.os} />
          <span className="min-w-0">
            <strong className="block truncate text-[13px] leading-normal font-semibold">
              {h.name}
            </strong>
            <small className="mt-[3px] block truncate font-mono text-xs text-muted-foreground">
              {i?.username || h.username
                ? (i?.username ?? h.username) + "@"
                : ""}
              {endpoint(h)}
            </small>
            {!i && !h.username && (
              <small className="mt-[3px] text-destructive block truncate text-[12px]">
                {t("hosts.hostCard.credentialsMissing")}
              </small>
            )}
          </span>
        </Button>
        <HostEditButton host={h} busy={busy} floating onEdit={actions.onEdit} />
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-[230px]"
        aria-label={t("hosts.collectionTables.actionsName", { name: h.name })}
      >
        <HostMenuItems host={h} busy={busy} actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
