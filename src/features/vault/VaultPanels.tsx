import { Trans } from "react-i18next";
import { useTranslation } from "react-i18next";
import { Panel } from "@/features/hosts/Panel";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callout, help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function VaultPanels() {
  const { t } = useTranslation();
  const {
    vault: { view, busy, error, setError },
    tabs: { tabs, pendingClose, setPendingClose, closeOthers },
    session: {
      vaultDialog,
      setVaultDialog,
      submitVaultDialog,
      pendingSwitch,
      setPendingSwitch,
      pendingLock,
      setPendingLock,
      switchVault,
      lockVault,
    },
    closeGuard,
  } = useApp();
  return (
    <>
      {vaultDialog && (
        <Panel
          variant="dialog"
          title={
            vaultDialog.mode === "create"
              ? t("vault.vaultList.newVault")
              : t("vault.vaultPanels.renameVault")
          }
          busy={busy}
          error={error}
          onClose={() => {
            setVaultDialog(null);
            setError("");
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitVaultDialog();
            }}
          >
            <label>
              {t("vault.vaultPanels.name")}
              <Input
                autoFocus
                required
                maxLength={80}
                value={vaultDialog.name}
                onChange={(e) =>
                  setVaultDialog({ ...vaultDialog, name: e.target.value })
                }
                placeholder={t("vault.vaultPanels.personalWorkClient")}
              />
            </label>
            {vaultDialog.mode === "create" && (
              <>
                <p className={help}>
                  {t("vault.vaultPanels.afterCreatingItChoose")}
                </p>
                {tabs.length > 0 && (
                  <div className={callout}>
                    {t("vault.vaultPanels.createClosesSessions", {
                      count: tabs.length,
                    })}
                  </div>
                )}
              </>
            )}
            <footer>
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => setVaultDialog(null)}
              >
                {t("vault.deleteVaultDialog.cancel")}
              </Button>
              <Button
                variant="default"
                type="submit"
                className="primary"
                disabled={busy}
              >
                {vaultDialog.mode === "create"
                  ? t("vault.vaultPanels.createVault")
                  : t("vault.vaultPanels.saveName")}
              </Button>
            </footer>
          </form>
        </Panel>
      )}
      {pendingSwitch && (
        <Panel
          variant="alert"
          title={t("vault.vaultPanels.switchVault")}
          busy={busy}
          error={error}
          onClose={() => setPendingSwitch(null)}
        >
          <AlertDialogDescription>
            <Trans
              i18nKey="vault.vaultPanels.switchTo"
              values={{
                name: view.vaults.find((v) => v.id === pendingSwitch)?.name,
              }}
              components={{ strong: <strong /> }}
            />
          </AlertDialogDescription>
          <div className={callout}>
            {t("vault.vaultPanels.switchClosesSessions", {
              count: tabs.length,
            })}
          </div>
          <footer>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => switchVault(pendingSwitch)}
            >
              {t("vault.vaultPanels.closeSessionsAndSwitch")}
            </Button>
          </footer>
        </Panel>
      )}
      {pendingClose && (
        <Panel
          variant="alert"
          title={t("vault.vaultPanels.closeOtherSessions")}
          busy={busy}
          error={error}
          onClose={() => setPendingClose(null)}
        >
          <AlertDialogDescription>
            {t("vault.vaultPanels.closeSessions", {
              count: pendingClose.length,
            })}
          </AlertDialogDescription>
          <footer>
            <Button
              variant="destructive"
              type="button"
              disabled={busy}
              className="danger"
              onClick={closeOthers}
            >
              {t("vault.vaultPanels.closeSessions")}
            </Button>
          </footer>
        </Panel>
      )}
      {closeGuard.dialog}
      {pendingLock && (
        <Panel
          variant="alert"
          title={t("vault.vaultPanels.lockVault")}
          busy={busy}
          error={error}
          onClose={() => setPendingLock(false)}
        >
          <AlertDialogDescription>
            {t("vault.vaultPanels.lockAndClose", { count: tabs.length })}
          </AlertDialogDescription>
          <footer>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={lockVault}
            >
              {t("vault.vaultPanels.closeSessionsAndLock")}
            </Button>
          </footer>
        </Panel>
      )}
    </>
  );
}
