import { ActionMenu } from "@/components/ActionMenu";
import { OsIcon } from "@/components/OsIcon";
import { TabLead, TabMain, TabShell, tabRenameClass } from "./Tab";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { type TerminalTab } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  TerminalSquare,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app/app-context";

const tabLabel = (t: TerminalTab) =>
  t.name ?? (t.layout ? "Workspace" : t.termTitle || t.title);

export function SessionTab({ tab }: { tab: TerminalTab }) {
  const {
    vault: { view },
    tabs: {
      tabs,
      bar,
      active,
      setActive,
      focusOf,
      setSavingWs,
      setPendingClose,
      askClosePane,
      askCloseTab,
      duplicateTab,
      reorder,
      renameTab,
    },
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
  return (
    <TabShell
      selected={active === tab.id}
      dragging={drag?.id === tab.id}
      drop={
        drag?.over === tab.id ? (drag.after ? "after" : "before") : undefined
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
        {tab.layout && (
          <DropdownMenuItem
            onClick={() => setSavingWs({ tabId: tab.id, name: tab.name ?? "" })}
          >
            Salva come workspace…
          </DropdownMenuItem>
        )}
        {tab.layout && (
          <DropdownMenuItem onClick={() => askClosePane(focusOf(tab))}>
            Chiudi pannello attivo
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => setRenaming(true)}>
          Rinomina
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => duplicateTab(tab)}>
          Duplica sessione
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => duplicateTab(tab, true)}>
          Riconnetti
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={bar.length < 2}
          onClick={() =>
            setPendingClose(
              tabs
                .filter((t) => t.id !== tab.id && t.parent !== tab.id)
                .map((t) => t.id),
            )
          }
        >
          Chiudi altre sessioni
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={bar[0].id === tab.id}
          onClick={() => {
            const index = bar.findIndex((t) => t.id === tab.id);
            reorder(tab.id, bar[index - 1].id);
          }}
        >
          <ArrowLeft size={12} />
          Sposta a sinistra
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={bar[bar.length - 1].id === tab.id}
          onClick={() => {
            const index = bar.findIndex((t) => t.id === tab.id);
            reorder(tab.id, bar[index + 1].id);
          }}
        >
          <ArrowRight size={12} />
          Sposta a destra
        </DropdownMenuItem>
      </ActionMenu>
    </TabShell>
  );
}
