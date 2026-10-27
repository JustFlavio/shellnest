import { IdentitiesTable, KeysTable } from "./CollectionTables";
import { HostsView } from "./HostsView";
import { Button } from "@/components/ui/button";
import { ancestry } from "./groups.ts";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Fragment } from "react";
import { useApp } from "@/app/app-context";
import { EmptyState } from "./EmptyState";

export function VaultContent() {
  const {
    vault: { view, busy, setError },
    tabs: { connect },
    library: {
      page,
      group,
      query,
      layout,
      hostForm,
      selected,
      setSelected,
      selectedFolders,
      setSelectedFolders,
      openGroup,
      showUsage,
      groupHostCount,
      editHost,
      duplicateHost,
      newFolderIn,
      editGroup,
      editIdentity,
      editKey,
      askDelete,
      openBulkAssign,
      hostRows,
      identityRows,
      keyRows,
    },
  } = useApp();
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-auto p-[22px] max-[1100px]:p-[18px]",
        page === "hosts" && selected.size > 1 && "pb-[100px]",
      )}
    >
      {page === "hosts" && group && (
        <div className="mb-[16px] flex items-center justify-start gap-[6px] [&>span]:text-muted-foreground">
          <Button
            variant="link"
            type="button"
            className="text-[12px]"
            onClick={() => openGroup("")}
          >
            <ArrowLeft size={12} />
            Tutte le cartelle
          </Button>
          {ancestry(view.groups, group)
            .reverse()
            .map((g) => (
              <Fragment key={g.id}>
                <span aria-hidden="true">/</span>
                <Button
                  variant="link"
                  type="button"
                  className="text-[12px]"
                  aria-current={g.id === group ? "page" : undefined}
                  onClick={() => openGroup(g.id)}
                >
                  {g.name}
                </Button>
              </Fragment>
            ))}
        </div>
      )}
      <div
        className={
          page === "hosts"
            ? "hosts-wrap flex w-full min-w-0 flex-[1_0_auto] overflow-visible [&:has(>.empty)>*:not(.empty)]:hidden"
            : "w-full min-w-0 overflow-auto rounded-[9px] border border-border has-[>.empty]:flex has-[>.empty]:flex-1 has-[>.empty]:border-0 [&:has(>.empty)>table]:hidden"
        }
      >
        {page === "hosts" ? (
          <HostsView
            hosts={hostRows}
            groups={view.groups}
            hostCount={groupHostCount}
            group={group}
            searching={Boolean(query.trim())}
            onOpenGroup={openGroup}
            onNewGroup={newFolderIn}
            onEditGroup={editGroup}
            onDeleteGroup={(g) =>
              askDelete({ kind: "groups", id: g.id, name: g.name })
            }
            editingId={hostForm?.id}
            identities={view.identities}
            layout={layout}
            selected={selected}
            selectedFolders={selectedFolders}
            onSelectFolders={setSelectedFolders}
            onSelect={setSelected}
            onConnect={connect}
            onEdit={editHost}
            onDuplicate={duplicateHost}
            onAssign={(host) =>
              openBulkAssign(new Set([host.id]), host.identityId)
            }
            onDelete={(host) =>
              askDelete({ kind: "hosts", id: host.id, name: host.name })
            }
            onEditIdentity={editIdentity}
            onError={setError}
            busy={busy}
          />
        ) : page === "identities" ? (
          <IdentitiesTable
            identities={identityRows}
            keys={view.keys}
            busy={busy}
            onEdit={(id) =>
              editIdentity(view.identities.find((i) => i.id === id)!)
            }
            onDelete={(id, name) => askDelete({ kind: "identities", id, name })}
            onUsage={showUsage}
          />
        ) : (
          <KeysTable
            keys={keyRows}
            identities={view.identities}
            busy={busy}
            onEdit={(id) => editKey(view.keys.find((k) => k.id === id)!)}
            onDelete={(id, name) => askDelete({ kind: "keys", id, name })}
            onUsage={showUsage}
          />
        )}
        <EmptyState />
      </div>
    </div>
  );
}
