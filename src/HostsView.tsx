import type { MouseEvent, KeyboardEvent } from "react";
import { Card } from "./components/ui/card";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
} from "./components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import {
  ChevronRight,
  KeyRound,
  LockKeyhole,
  Pencil,
  Trash2,
  Copy,
  FolderPlus,
  UserRound,
  Folder,
} from "lucide-react";
import { OsIcon } from "./OsIcon";
import { ActionMenu } from "./ActionMenu";
import type { Group, Host, Identity } from "./types";
import { childGroups } from "./groups.mjs";
import { CollectionSelection } from "./CollectionSelection";
type Props = {
  hosts: Host[];
  editingId?: string;
  identities: Identity[];
  layout: "list" | "cards";
  groups: Group[];
  // Folder currently open (its id); empty at the top level.
  group?: string;
  hostCount: (groupId: string) => number;
  searching?: boolean;
  onOpenGroup: (groupId: string) => void;
  onNewGroup: (parentId: string) => void;
  onEditGroup: (group: Group) => void;
  onDeleteGroup: (group: Group) => void;
  selected: Set<string>;
  selectedFolders?: Set<string>;
  onSelectFolders?: (names: Set<string>) => void;
  onSelect: (ids: Set<string>) => void;
  onConnect: (host: Host) => void;
  onEdit: (host: Host) => void;
  onDuplicate: (host: Host) => void;
  onAssign: (host: Host) => void;
  onDelete: (host: Host) => void;
  onEditIdentity: (identity: Identity) => void;
  onError: (error: string) => void;
  busy: boolean;
};
const tableClass = cn(
  "w-full border-separate border-spacing-0 text-left text-[13px]",
  "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-1",
  "[&_th]:h-[30px] [&_th]:border-b [&_th]:border-border [&_th]:bg-sidebar [&_th]:px-[12px] [&_th]:text-[12px] [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted-foreground",
  "[&_td]:h-[40px] [&_td]:border-b [&_td]:border-border [&_td]:px-[12px] [&_td]:py-[3px] [&_td]:align-middle [&_td]:whitespace-nowrap",
  "[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr]:animate-[rise_0.28s_cubic-bezier(0.2,0.7,0.2,1)_backwards] [&_tbody_tr:hover]:bg-card",
  "[&_tbody_tr.checked]:bg-accent [&_tbody_tr.checked]:outline [&_tbody_tr.checked]:-outline-offset-1 [&_tbody_tr.checked]:outline-primary",
);
const cardsGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-[10px]";
export function HostsView(p: Props) {
  const identity = (h: Host) =>
    p.identities.find((i) => i.id === (h.effectiveIdentityId || h.identityId));
  const selectFolder = (
    name: string,
    e: Pick<MouseEvent, "ctrlKey" | "metaKey">,
  ) => {
    if (p.busy) return;
    const additive = e.ctrlKey || e.metaKey;
    const next = new Set(additive ? p.selectedFolders : []);
    if (additive && next.has(name)) next.delete(name);
    else next.add(name);
    if (!additive) p.onSelect(new Set());
    p.onSelectFolders?.(next);
  };
  const select = (h: Host, e: Pick<MouseEvent, "ctrlKey" | "metaKey">) => {
    if (p.busy) return;
    if (!e.ctrlKey && !e.metaKey) p.onSelectFolders?.(new Set());
    const next =
      e.ctrlKey || e.metaKey ? new Set(p.selected) : new Set<string>();
    if ((e.ctrlKey || e.metaKey) && next.has(h.id)) next.delete(h.id);
    else next.add(h.id);
    p.onSelect(next);
  };
  const keyboard = (h: Host, e: KeyboardEvent) => {
    if (e.target !== e.currentTarget || p.busy) return;
    if (e.key === "Enter") {
      e.preventDefault();
      p.onConnect(h);
    }
    if (e.key === " ") {
      e.preventDefault();
      select(h, e);
    }
  };
  const endpoint = (h: Host) => h.address + (h.port === 22 ? "" : ":" + h.port);
  const folders = p.searching ? [] : childGroups(p.groups, p.group ?? "");
  const hosts =
    p.group || p.searching ? p.hosts : p.hosts.filter((h) => !h.groupId);
  const edit = (h: Host, floating = false) => (
    <Button
      variant="ghost"
      className={cn(
        "size-[30px] p-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        floating && "absolute top-1/2 right-[8px] -translate-y-1/2",
      )}
      disabled={p.busy}
      aria-label={"Modifica " + h.name}
      title={"Modifica " + h.name}
      onClick={() => p.onEdit(h)}
    >
      <Pencil size={15} />
    </Button>
  );
  const actions = (h: Host) => (
    <>
      <DropdownMenuItem disabled={p.busy} onClick={() => p.onConnect(h)}>
        <ChevronRight size={14} />
        Connetti
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        role="menuitem"
        aria-label={`Modifica ${h.name}`}
        disabled={p.busy}
        onClick={() => p.onEdit(h)}
      >
        <Pencil size={13} />
        Modifica
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={p.busy}
        onClick={() => p.onDuplicate(h)}
      >
        <Copy size={13} />
        Duplica host
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={p.busy}
        onClick={() => p.onAssign(h)}
      >
        <UserRound size={13} />
        Assegna identità
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        onClick={() =>
          void navigator.clipboard
            .writeText(h.address)
            .catch((e) => p.onError(String(e)))
        }
      >
        <Copy size={13} />
        Copia indirizzo
      </DropdownMenuItem>
      <DropdownMenuItem
        role="menuitem"
        disabled={p.busy}
        variant="destructive"
        onClick={() => p.onDelete(h)}
      >
        <Trash2 size={13} />
        Elimina host
      </DropdownMenuItem>
    </>
  );
  const tile = (h: Host, index: number) => {
    const i = identity(h);
    return (
      <ContextMenu key={h.id}>
        <ContextMenuTrigger
          render={
            <Card
              data-selection-id={h.id}
              style={{ animationDelay: `${Math.min(index, 4) * 30}ms` }}
              className={cn(
                "group relative h-[64px] min-w-0 flex-row items-center gap-0 border border-transparent p-0 shadow-none ring-0 animate-[rise_0.28s_cubic-bezier(0.2,0.7,0.2,1)_backwards] transition hover:-translate-y-px hover:border-input hover:bg-accent focus-within:border-input focus-within:bg-accent",
                (p.selected.has(h.id) || p.editingId === h.id) &&
                  "border-primary bg-card hover:border-primary hover:bg-card focus-within:border-primary focus-within:bg-card",
              )}
            />
          }
        >
          <Button
            variant="ghost"
            className="h-full w-full min-w-0 justify-start gap-[10px] rounded-[11px] py-[9px] pr-[46px] pl-[10px] text-left hover:bg-transparent"
            disabled={p.busy}
            aria-label={"Seleziona " + h.name}
            aria-pressed={p.selected.has(h.id)}
            onClick={(e) => select(h, e)}
            onDoubleClick={() => {
              if (!p.busy) p.onConnect(h);
            }}
            onKeyDown={(e) => keyboard(h, e)}
            title={"Doppio clic per connettere a " + endpoint(h)}
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
                <small className="invalid mt-[3px] block truncate text-[12px]">Credenziali mancanti</small>
              )}
            </span>
          </Button>
          {edit(h, true)}
        </ContextMenuTrigger>
        <ContextMenuContent
          className="host-context-menu"
          aria-label={"Azioni " + h.name}
        >
          {actions(h)}
        </ContextMenuContent>
      </ContextMenu>
    );
  };
  const row = (h: Host) => {
    const i = identity(h);
    return (
      <ContextMenu key={h.id}>
        <ContextMenuTrigger
          render={<tr />}
          data-selection-id={h.id}
          className={cn("group", p.selected.has(h.id) && "checked")}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button")) select(h, e);
          }}
          onDoubleClick={(e) => {
            if (!p.busy && !(e.target as HTMLElement).closest("button"))
              p.onConnect(h);
          }}
        >
          <td>
            <Button
              variant="ghost"
              className="h-auto justify-start gap-[10px] p-0 text-[13px] text-foreground"
              disabled={p.busy}
              aria-label={"Seleziona " + h.name}
              aria-pressed={p.selected.has(h.id)}
              onClick={(e) => select(h, e)}
              onDoubleClick={() => {
                if (!p.busy) p.onConnect(h);
              }}
              onKeyDown={(e) => keyboard(h, e)}
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
                disabled={p.busy}
                onClick={() => p.onEditIdentity(i)}
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
              <span className="inline">
                <UserRound size={14} />
                {h.username}
                <span className="dim">· host</span>
              </span>
            ) : (
              <span className="invalid">Identità mancante</span>
            )}
          </td>
          <td>
            <div className="flex items-center justify-end gap-[3px] [&_button]:size-[28px] [&_button]:p-0 [&_button]:text-muted-foreground">
              {edit(h)}
              <ActionMenu label={"Azioni " + h.name}>{actions(h)}</ActionMenu>
            </div>
          </td>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="host-context-menu"
          aria-label={"Azioni " + h.name}
        >
          {actions(h)}
        </ContextMenuContent>
      </ContextMenu>
    );
  };
  const table = (items: Host[]) => (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>Nome</th>
          <th>Indirizzo</th>
          <th>Accesso</th>
          <th className="min-w-[88px] text-right">
            <span className="visually-hidden">Azioni</span>
          </th>
        </tr>
      </thead>
      <tbody>{items.map(row)}</tbody>
    </table>
  );
  return (
    <CollectionSelection
      busy={p.busy}
      selected={{ hosts: p.selected, folders: p.selectedFolders ?? new Set() }}
      onSelect={({ hosts, folders }) => {
        p.onSelect(hosts);
        p.onSelectFolders?.(folders);
      }}
    >
      {folders.length > 0 && (
        <section aria-label="Cartelle">
          <h2>Cartelle</h2>
          <div className={p.layout === "cards" ? cardsGrid : "grid gap-[6px]"}>
            {folders.map((g) => {
              const subfolders = p.groups.filter((o) => o.parentId === g.id);
              return (
                <div
                  className="group relative min-w-0 animate-[rise_0.28s_cubic-bezier(0.2,0.7,0.2,1)_backwards]"
                  key={g.id}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex w-full min-w-0 justify-start gap-[12px] rounded-xl border border-transparent bg-card px-[10px] text-left hover:bg-accent aria-pressed:border-primary",
                      p.layout === "cards" ? "h-[64px] py-[9px]" : "h-[48px] py-[5px]",
                    )}
                    data-selection-id={g.id}
                    data-selection-kind="folder"
                    aria-label={`Seleziona cartella ${g.name}`}
                    aria-pressed={p.selectedFolders?.has(g.id) ?? false}
                    title={`Doppio clic per aprire ${g.name}`}
                    disabled={p.busy}
                    onClick={(e) => selectFolder(g.id, e)}
                    onDoubleClick={() => {
                      if (!p.busy) p.onOpenGroup(g.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!p.busy) p.onOpenGroup(g.id);
                      }
                      if (e.key === " ") {
                        e.preventDefault();
                        selectFolder(g.id, e);
                      }
                    }}
                  >
                    <span
                      className={cn(
                        "grid shrink-0 place-items-center rounded-[11px] bg-accent text-primary",
                        p.layout === "cards" ? "size-[44px]" : "size-[36px]",
                      )}
                    >
                      <Folder className="size-[24px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">{g.name}</strong>
                      <small className="mt-[3px] block truncate text-[11px] font-normal text-muted-foreground">
                        {p.hostCount(g.id)} host
                        {subfolders.length > 0 &&
                          ` · ${subfolders.length} ${subfolders.length === 1 ? "sottogruppo" : "sottogruppi"}`}
                      </small>
                    </span>
                  </Button>
                  <ActionMenu
                    label={`Azioni cartella ${g.name}`}
                    className="absolute top-1/2 right-[10px] -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100"
                  >
                    <DropdownMenuItem
                      disabled={p.busy}
                      onClick={() => p.onOpenGroup(g.id)}
                    >
                      <Folder size={13} />
                      Apri
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={p.busy}
                      onClick={() => p.onEditGroup(g)}
                    >
                      <Pencil size={13} />
                      Modifica gruppo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={p.busy}
                      onClick={() => p.onNewGroup(g.id)}
                    >
                      <FolderPlus size={13} />
                      Nuovo sottogruppo
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={p.busy}
                      onClick={() => p.onDeleteGroup(g)}
                    >
                      <Trash2 size={13} />
                      Elimina gruppo
                    </DropdownMenuItem>
                  </ActionMenu>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {(hosts.length > 0 || folders.length > 0) && (
        <section aria-label="Host">
          {p.layout === "cards" && (
            <h2>{p.groups.find((g) => g.id === p.group)?.name ?? "Host"}</h2>
          )}
          {hosts.length > 0 ? (
            p.layout === "cards" ? (
              <div className={cardsGrid}>{hosts.map(tile)}</div>
            ) : (
              table(hosts)
            )
          ) : (
            <p className="muted">
              {p.group
                ? "Nessun host in questa cartella."
                : "Nessun host fuori dalle cartelle."}
            </p>
          )}
        </section>
      )}
    </CollectionSelection>
  );
}
