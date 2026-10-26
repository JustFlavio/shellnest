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
import {
  ChevronRight,
  KeyRound,
  LockKeyhole,
  Pencil,
  Trash2,
  Copy,
  UserRound,
  Folder,
} from "lucide-react";
import { OsIcon } from "./OsIcon";
import { ActionMenu } from "./ActionMenu";
import type { Host, Identity } from "./types";
import { CollectionSelection } from "./CollectionSelection";
type Props = {
  hosts: Host[];
  editingId?: string;
  identities: Identity[];
  layout: "list" | "cards";
  group?: string;
  searching?: boolean;
  onOpenGroup: (group: string) => void;
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
export function HostsView(p: Props) {
  const identity = (h: Host) => p.identities.find((i) => i.id === h.identityId);
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
  const groups =
    p.group || p.searching
      ? []
      : [...new Set(p.hosts.map((h) => h.group).filter(Boolean))].sort();
  const hosts =
    p.group || p.searching ? p.hosts : p.hosts.filter((h) => !h.group);
  const edit = (h: Host) => (
    <Button
      variant="ghost"
      className="host-edit"
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
  const tile = (h: Host) => {
    const i = identity(h);
    return (
      <ContextMenu key={h.id}>
        <ContextMenuTrigger
          render={
            <Card
              data-selection-id={h.id}
              className={
                "host-tile" +
                (p.selected.has(h.id) ? " checked" : "") +
                (p.editingId === h.id ? " editing" : "")
              }
            />
          }
        >
          <Button
            variant="ghost"
            className="tile-select"
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
            <span>
              <strong>{h.name}</strong>
              <small className="mono">
                {i?.username || h.username
                  ? (i?.username ?? h.username) + "@"
                  : ""}
                {endpoint(h)}
              </small>
              {!i && !h.username && (
                <small className="invalid">Credenziali mancanti</small>
              )}
            </span>
          </Button>
          {edit(h)}
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
          className={p.selected.has(h.id) ? "checked" : ""}
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
              className="host-name"
              disabled={p.busy}
              aria-label={"Seleziona " + h.name}
              aria-pressed={p.selected.has(h.id)}
              onClick={(e) => select(h, e)}
              onDoubleClick={() => {
                if (!p.busy) p.onConnect(h);
              }}
              onKeyDown={(e) => keyboard(h, e)}
            >
              <OsIcon os={h.os} />
              {h.name}
            </Button>
          </td>
          <td className="mono">{endpoint(h)}</td>
          <td>
            {i ? (
              <Button
                variant="ghost"
                className="cell-link"
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
                  <small className="identity-username"> · {i.username}</small>
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
            <div className="row-actions">
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
    <table className="host-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Indirizzo</th>
          <th>Accesso</th>
          <th className="actions-col">
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
      {groups.length > 0 && (
        <section aria-label="Cartelle">
          <h2>Cartelle</h2>
          <div className={p.layout === "cards" ? "host-cards" : "folder-rows"}>
            {groups.map((name) => (
              <Button
                variant="ghost"
                key={name}
                className="folder-tile"
                data-selection-id={name}
                data-selection-kind="folder"
                aria-label={`Seleziona cartella ${name}`}
                aria-pressed={p.selectedFolders?.has(name) ?? false}
                title={`Doppio clic per aprire ${name}`}
                disabled={p.busy}
                onClick={(e) => selectFolder(name, e)}
                onDoubleClick={() => {
                  if (!p.busy) p.onOpenGroup(name);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!p.busy) p.onOpenGroup(name);
                  }
                  if (e.key === " ") {
                    e.preventDefault();
                    selectFolder(name, e);
                  }
                }}
              >
                <span className="folder-icon">
                  <Folder className="size-6" />
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>
                    {p.hosts.filter((h) => h.group === name).length} host
                  </small>
                </span>
              </Button>
            ))}
          </div>
        </section>
      )}
      {(hosts.length > 0 || groups.length > 0) && (
        <section aria-label="Host">
          {p.layout === "cards" && <h2>{p.group || "Host"}</h2>}
          {hosts.length > 0 ? (
            p.layout === "cards" ? (
              <div className="host-cards">{hosts.map(tile)}</div>
            ) : (
              table(hosts)
            )
          ) : (
            <p className="muted">Nessun host fuori dalle cartelle.</p>
          )}
        </section>
      )}
    </CollectionSelection>
  );
}
