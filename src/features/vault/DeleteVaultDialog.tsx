import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Panel } from "@/features/hosts/Editors";

export function DeleteVaultDialog({
  vaultName,
  busy,
  onCancel,
  onConfirm,
}: {
  vaultName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Panel
      variant="alert"
      title="Eliminare il vault?"
      busy={busy}
      error=""
      onClose={onCancel}
    >
      <AlertDialogDescription>
        «{vaultName}» è vuoto e verrà rimosso. Tornerai al vault Personale e le
        sessioni aperte verranno chiuse.
      </AlertDialogDescription>
      <footer>
        <Button
          variant="ghost"
          type="button"
          data-alert-cancel
          onClick={onCancel}
        >
          Annulla
        </Button>
        <Button
          variant="destructive"
          type="button"
          className="danger"
          disabled={busy}
          onClick={onConfirm}
        >
          Elimina
        </Button>
      </footer>
    </Panel>
  );
}
