import { Button } from "./components/ui/button";
import { childGroups } from "./groups.mjs";
import { Plus } from "lucide-react";
import { useApp } from "./app-context";

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
  return (
    <div className="empty flex flex-1 flex-col items-center justify-center px-[24px] pt-[24px] pb-[8vh] text-center text-muted-foreground [&_button]:border [&_button]:border-input [&_h2]:text-foreground [&_p]:mt-[12px] [&_p]:mb-[20px] [&_p]:max-w-[390px] [&_p]:text-[13px] [&_p]:leading-[1.7]">
      <h2>
        {query || usage
          ? "Nessun risultato"
          : page === "hosts" && group
            ? "Cartella vuota"
            : page === "hosts"
              ? "Nessun host"
              : page === "identities"
                ? "Nessuna identità"
                : "Nessuna chiave SSH"}
      </h2>
      <p>
        {query || usage
          ? "Modifica la ricerca o rimuovi i filtri."
          : page === "hosts" && group
            ? "Aggiungi un host o crea un sottogruppo."
            : page === "hosts"
              ? "Crea un’identità e assegnala ai tuoi server."
              : page === "identities"
                ? "Crea un’identità con utente SSH e una chiave dal portachiavi, oppure una password."
                : "Importa la chiave privata una volta, poi selezionala nelle identità."}
      </p>
      {query || usage ? (
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
          {page === "hosts"
            ? "Aggiungi host"
            : page === "identities"
              ? "Crea identità"
              : "Importa chiave"}
        </Button>
      )}
    </div>
  );
}
