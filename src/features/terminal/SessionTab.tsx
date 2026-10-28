import { ActionMenu } from "@/components/ActionMenu";
import { OsIcon } from "@/components/OsIcon";
import { TabLead, TabMain, TabShell, tabRenameClass } from "./Tab";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { type TerminalTab } from "@/lib/types";
import {
  Columns2,
  Copy,
  LayoutGrid,
  Pencil,
  Rows2,
  Save,
  TerminalSquare,
  X,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app/app-context";

const tabLabel = (t: TerminalTab) =>
  t.name ?? (t.layout ? "Workspace" : t.termTitle || t.title);

export function SessionTab({ tab }: { tab: TerminalTab }) {
  const {
    vault: { view },
    tabs: {
      active,
      setActive,
      setSavingWs,
      askCloseTab,
      duplicateTab,
      splitTab,
      reorder,
      renameTab,
    },
    preferences: { hint },
    dnd: { drag, setDrag, clearDnd, springOpen },
  } = useApp();
  const [renaming, setRenaming] = useState(false);
  const icon = tab.layout ? (
    <LayoutGrid size={14} />
  ) : tab.kind === "ssh" ? (
    <OsIcon
      size="tab"
      os={view.hosts.find((h) => h.id === tab.host.id)?.os ?? tab.host.os}
    />
  ) : (
    <TerminalSquare size={14} />
  );
  const items = (
    <>
      <DropdownMenuItem onClick={() => duplicateTab(tab)}>
        <Copy size={13} />
        Duplica
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setRenaming(true)}>
        <Pencil size={13} />
        Rinomina
      </DropdownMenuItem>
      {tab.layout && (
        <DropdownMenuItem
          onClick={() => setSavingWs({ tabId: tab.id, name: tab.name ?? "" })}
        >
          <Save size={13} />
          Salva come workspace…
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => splitTab(tab.id, "row")}>
        <Columns2 size={13} />
        Dividi verticalmente
        <DropdownMenuShortcut>{hint("splitRight")}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => splitTab(tab.id, "col")}>
        <Rows2 size={13} />
        Dividi orizzontalmente
        <DropdownMenuShortcut>{hint("splitDown")}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => askCloseTab(tab.id)}>
        <X size={13} />
        Chiudi
        <DropdownMenuShortcut>
          {hint(tab.layout ? "closeWorkspace" : "closePane")}
        </DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <TabShell
            selected={active === tab.id}
            dragging={drag?.id === tab.id}
            drop={
              drag?.over === tab.id
                ? drag.after
                  ? "after"
                  : "before"
                : undefined
            }
          />
        }
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/x-shellnest-tab", tab.id);
          setDrag({ id: tab.id });
        }}
        onDragEnd={clearDnd}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("application/x-shellnest-tab"))
            return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          springOpen(tab.id);
          const r = e.currentTarget.getBoundingClientRect();
          const after = e.clientX > r.left + r.width / 2;
          setDrag((d) =>
            d && (d.over !== tab.id || d.after !== after)
              ? { ...d, over: tab.id, after }
              : d,
          );
        }}
        onDrop={(e) => {
          e.preventDefault();
          const moving = e.dataTransfer.getData("application/x-shellnest-tab");
          reorder(moving, tab.id);
          clearDnd();
        }}
      >
        <TabLead
          icon={icon}
          onClose={() => askCloseTab(tab.id)}
          label={tabLabel(tab)}
        />
        {renaming ? (
          <input
            className={tabRenameClass}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the rename field opens on the user's own action
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={tabLabel(tab)}
            aria-label="Nome scheda"
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              const name = e.currentTarget.value.trim();
              renameTab(tab.id, name || undefined);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <TabMain
            aria-current={active === tab.id ? "page" : undefined}
            title={tabLabel(tab)}
            onClick={() => setActive(tab.id)}
            onDoubleClick={() => setRenaming(true)}
          >
            {tabLabel(tab)}
          </TabMain>
        )}
        <ActionMenu
          label={`Azioni scheda ${tab.title}`}
          className="size-[24px] text-inherit opacity-0 transition-opacity group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 group-data-[selected]/tab:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none"
        >
          {items}
        </ActionMenu>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-[230px]"
        aria-label={`Azioni scheda ${tab.title}`}
      >
        {items}
      </ContextMenuContent>
    </ContextMenu>
  );
}
