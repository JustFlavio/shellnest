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

function emptyHint(page: Page, group: string, filtered: boolean) {
  if (filtered) return "Modifica la ricerca o rimuovi i filtri.";
  if (page === "hosts")
    return group
      ? "Aggiungi un host o crea un sottogruppo."
      : "Crea un’identità e assegnala ai tuoi server.";
  return page === "identities"
    ? "Crea un’identità con utente SSH e una chiave dal portachiavi, oppure una password."
    : "Importa la chiave privata una volta, poi selezionala nelle identità.";
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
    <div className="empty flex flex-1 flex-col items-center justify-center px-[24px] pt-[24px] pb-[8vh] text-center text-muted-foreground [&_button]:border [&_button]:border-input [&_h2]:text-foreground [&_p]:mt-[12px] [&_p]:mb-[20px] [&_p]:max-w-[390px] [&_p]:text-[13px] [&_p]:leading-[1.7]">
      <h2>{emptyTitle(page, group, filtered)}</h2>
      <p>{emptyHint(page, group, filtered)}</p>
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
