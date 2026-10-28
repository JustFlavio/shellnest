import type { MouseEvent } from "react";
import type { Group, Host, Identity } from "@/lib/types";
import { childGroups } from "./groups.ts";
import { CollectionSelection } from "./CollectionSelection";
import { FolderCard } from "./FolderCard";
import { HostCard } from "./HostCard";
import { HostRow } from "./HostRow";
import { HostTable } from "./HostTable";

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
  busy: boolean;
};
const cardsGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-[10px]";
export function HostsView(p: Props) {
  const identitiesById = new Map(p.identities.map((i) => [i.id, i]));
  const identity = (h: Host) =>
    identitiesById.get(h.effectiveIdentityId || h.identityId);
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
  const folders = p.searching ? [] : childGroups(p.groups, p.group ?? "");
  const hosts =
    p.group || p.searching ? p.hosts : p.hosts.filter((h) => !h.groupId);
  const actions = {
    onConnect: p.onConnect,
    onEdit: p.onEdit,
    onDuplicate: p.onDuplicate,
    onAssign: p.onAssign,
    onDelete: p.onDelete,
  };
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
            {folders.map((g) => (
              <FolderCard
                key={g.id}
                folder={g}
                layout={p.layout}
                hostCount={p.hostCount(g.id)}
                subfolderCount={
                  p.groups.filter((o) => o.parentId === g.id).length
                }
                selected={p.selectedFolders?.has(g.id) ?? false}
                busy={p.busy}
                onSelect={selectFolder}
                onOpen={p.onOpenGroup}
                onEdit={p.onEditGroup}
                onNewGroup={p.onNewGroup}
                onDelete={p.onDeleteGroup}
              />
            ))}
          </div>
        </section>
      )}
      {hosts.length > 0 && (
        <section aria-label="Host">
          {p.layout === "cards" && (
            <h2>{p.groups.find((g) => g.id === p.group)?.name ?? "Host"}</h2>
          )}
          {p.layout === "cards" ? (
            <div className={cardsGrid}>
              {hosts.map((h, index) => (
                <HostCard
                  key={h.id}
                  host={h}
                  identity={identity(h)}
                  index={index}
                  selected={p.selected.has(h.id)}
                  editing={p.editingId === h.id}
                  busy={p.busy}
                  actions={actions}
                  onSelect={select}
                />
              ))}
            </div>
          ) : (
            <HostTable>
              {hosts.map((h) => (
                <HostRow
                  key={h.id}
                  host={h}
                  identity={identity(h)}
                  selected={p.selected.has(h.id)}
                  busy={p.busy}
                  actions={actions}
                  onSelect={select}
                  onEditIdentity={p.onEditIdentity}
                />
              ))}
            </HostTable>
          )}
        </section>
      )}
    </CollectionSelection>
  );
}
