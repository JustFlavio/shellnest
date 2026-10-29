import { useTranslation } from "react-i18next";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Panel } from "@/features/hosts/Panel";

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
  const { t } = useTranslation();
  return (
    <Panel
      variant="alert"
      title={t("vault.deleteVaultDialog.deleteTheVault")}
      busy={busy}
      error=""
      onClose={onCancel}
    >
      <AlertDialogDescription>
        {t("vault.deleteVaultDialog.emptyAndRemoved", { name: vaultName })}
      </AlertDialogDescription>
      <footer>
        <Button
          variant="ghost"
          type="button"
          data-alert-cancel
          onClick={onCancel}
        >
          {t("vault.deleteVaultDialog.cancel")}
        </Button>
        <Button
          variant="destructive"
          type="button"
          className="danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {t("vault.deleteVaultDialog.delete")}
        </Button>
      </footer>
    </Panel>
  );
}
