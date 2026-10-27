import { Panel } from "./Editors";
import { HostSummary } from "./HostSummary";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function DeletionDialog() {
  const {
    vault: { view, busy, error },
    library: { deletion, closeDeletion, confirmDeletion },
  } = useApp();
  if (!deletion) return null;
  return (
    <Panel
      variant="alert"
      title={
        deletion.kind === "hosts"
          ? "Elimina host"
          : deletion.kind === "identities"
            ? "Elimina identità"
            : deletion.kind === "groups"
              ? "Elimina gruppo"
              : "Elimina chiave"
      }
      busy={busy}
      error={error}
      onClose={closeDeletion}
    >
      <AlertDialogDescription>
        Eliminare <strong>{deletion.name}</strong> dal vault?
      </AlertDialogDescription>
      <p className={help}>
        {deletion.kind === "hosts"
          ? "La chiave e l’identità associate verranno conservate. Il server remoto non viene modificato."
          : deletion.kind === "groups"
            ? "Il gruppo deve essere vuoto: gli host e i sottogruppi non vengono eliminati."
            : "L’elemento verrà rimosso dal vault e dai dispositivi sincronizzati."}
      </p>
      {deletion.kind === "hosts" && (
        <HostSummary
          hosts={view.hosts.filter((host) =>
            (deletion.ids ?? [deletion.id]).includes(host.id),
          )}
          identities={view.identities}
        />
      )}
      <footer>
        <Button
          variant="destructive"
          type="button"
          className="danger"
          disabled={busy}
          onClick={confirmDeletion}
        >
          Elimina
        </Button>
      </footer>
    </Panel>
  );
}
