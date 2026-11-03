import { useTranslation } from "react-i18next";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Panel } from "@/features/hosts/Panel";

export function DeleteVaultDialog({
  vaultName,
  leaving,
  onServer,
  busy,
  onCancel,
  onConfirm,
}: {
  vaultName: string;
  // A member leaves a server vault; otherwise the vault is deleted, from the server too when there.
  leaving: boolean;
  onServer: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Panel
      variant="alert"
      title={
        leaving
          ? t("vault.deleteVaultDialog.leaveTheVault")
          : t("vault.deleteVaultDialog.deleteTheVault")
      }
      busy={busy}
      error=""
      onClose={onCancel}
    >
      <AlertDialogDescription>
        {leaving
          ? t("vault.deleteVaultDialog.leaveAndRemoved", { name: vaultName })
          : onServer
            ? t("vault.deleteVaultDialog.emptyAndRemovedFromServer", {
                name: vaultName,
              })
            : t("vault.deleteVaultDialog.emptyAndRemoved", { name: vaultName })}
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
          {leaving
            ? t("vault.deleteVaultDialog.leave")
            : t("vault.deleteVaultDialog.delete")}
        </Button>
      </footer>
    </Panel>
  );
}
