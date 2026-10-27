import { Button } from "@/components/ui/button";
import { TerminalSquare, Trash2, UserRound, X } from "lucide-react";
import { useApp } from "@/app/app-context";

export function SelectionBar() {
  const {
    vault: { view, busy },
    tabs: { connectHosts },
    library: { selected, clearSelection, askDelete, openBulkAssign },
  } = useApp();
  return (
    <div
      className="absolute bottom-[20px] left-1/2 z-2 flex w-max max-w-[calc(100%-32px)] animate-[selection-enter_180ms_cubic-bezier(0.16,1,0.3,1)] flex-wrap items-center justify-center gap-[6px] rounded-[12px] border border-input bg-card px-[8px] py-[6px] text-[12px] shadow-[0_8px_28px_#0006] [transform:translateX(-50%)] [&_button]:text-[12px] [&_strong]:mr-auto [&_strong]:font-medium"
      role="toolbar"
      aria-label="Azioni host selezionati"
    >
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() =>
          connectHosts(view.hosts.filter((h) => selected.has(h.id)))
        }
      >
        <TerminalSquare size={15} />
        Connetti
      </Button>
      <strong>
        {selected.size} selezionati
      </strong>
      <Button
        variant="ghost"
        type="button"
        disabled={busy}
        onClick={() => openBulkAssign(selected)}
      >
        <UserRound size={14} />
        Assegna identità
      </Button>
      <Button
        variant="destructive"
        disabled={busy}
        onClick={() =>
          askDelete({
            kind: "hosts",
            id: "",
            ids: [...selected],
            name: selected.size + " host selezionati",
          })
        }
      >
        <Trash2 size={15} />
        Elimina
      </Button>
      <Button
        variant="ghost"
        type="button"
        aria-label="Annulla selezione"
        disabled={busy}
        onClick={clearSelection}
      >
        <X size={15} />
      </Button>
    </div>
  );
}
