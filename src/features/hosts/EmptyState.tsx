import { Button } from "@/components/ui/button";
import { childGroups } from "./groups.ts";
import { Plus } from "lucide-react";
import { useApp } from "@/app/app-context";
import type { Page } from "./useLibrary";

const createLabels = {
  hosts: "Aggiungi host",
  identities: "Crea identità",
  keys: "Importa chiave",
} as const;

function emptyTitle(page: Page, group: string, filtered: boolean) {
  if (filtered) return "Nessun risultato";
  if (page === "hosts") return group ? "Cartella vuota" : "Nessun host";
  return page === "identities" ? "Nessuna identità" : "Nessuna chiave SSH";
}

export function EmptyState() {
  const {
    vault: { view, busy },
    library: {
      page,
      group,
      query,
      usage,
      clearFilters,
      createNew,
      hostRows,
      identityRows,
      keyRows,
    },
  } = useApp();
  const empty =
    (page === "hosts" &&
      !hostRows.length &&
      !(!query.trim() && !usage && childGroups(view.groups, group).length)) ||
    (page === "identities" && !identityRows.length) ||
    (page === "keys" && !keyRows.length);
  if (!empty) return null;
  const filtered = !!(query || usage);
  return (
    <div className="empty flex flex-1 flex-col items-center justify-center px-[24px] pt-[24px] pb-[8vh] text-center text-muted-foreground [&_button]:border [&_button]:border-input [&_h2]:mb-[16px] [&_h2]:text-foreground">
      <h2>{emptyTitle(page, group, filtered)}</h2>
      {filtered ? (
        <Button variant="ghost" type="button" onClick={clearFilters}>
          Rimuovi filtri
        </Button>
      ) : (
        <Button
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={createNew}
        >
          <Plus size={14} />
          {createLabels[page]}
        </Button>
      )}
    </div>
  );
}
