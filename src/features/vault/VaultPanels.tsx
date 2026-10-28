import { Panel } from "@/features/hosts/Panel";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callout, help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function VaultPanels() {
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
            vaultDialog.mode === "create" ? "Nuovo vault" : "Rinomina vault"
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
              Nome
              <Input
                autoFocus
                required
                maxLength={80}
                value={vaultDialog.name}
                onChange={(e) =>
                  setVaultDialog({ ...vaultDialog, name: e.target.value })
                }
                placeholder="Personale, Lavoro, Cliente…"
              />
            </label>
            {vaultDialog.mode === "create" && (
              <>
                <p className={help}>
                  Dopo la creazione scegli la password o collega un vault
                  remoto.
                </p>
                {tabs.length > 0 && (
                  <div className={callout}>
                    La creazione seleziona il nuovo vault e chiude tutte le{" "}
                    {tabs.length} sessioni aperte, incluse le shell locali.
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
                Annulla
              </Button>
              <Button
                variant="default"
                type="submit"
                className="primary"
                disabled={busy}
              >
                {vaultDialog.mode === "create" ? "Crea vault" : "Salva nome"}
              </Button>
            </footer>
          </form>
        </Panel>
      )}
      {pendingSwitch && (
        <Panel
          variant="alert"
          title="Cambia vault"
          busy={busy}
          error={error}
          onClose={() => setPendingSwitch(null)}
        >
          <AlertDialogDescription>
            Passare a{" "}
            <strong>
              {view.vaults.find((v) => v.id === pendingSwitch)?.name}
            </strong>
            ?
          </AlertDialogDescription>
          <div className={callout}>
            Verranno chiuse tutte le {tabs.length} sessioni aperte, incluse le
            shell locali. Il vault attuale verrà bloccato.
          </div>
          <footer>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => switchVault(pendingSwitch)}
            >
              Chiudi sessioni e cambia
            </Button>
          </footer>
        </Panel>
      )}
      {pendingClose && (
        <Panel
          variant="alert"
          title="Chiudi altre sessioni"
          busy={busy}
          error={error}
          onClose={() => setPendingClose(null)}
        >
          <AlertDialogDescription>
            Chiudere {pendingClose.length} sessioni? Le shell locali e le
            connessioni SSH selezionate verranno terminate.
          </AlertDialogDescription>
          <footer>
            <Button
              variant="destructive"
              type="button"
              disabled={busy}
              className="danger"
              onClick={closeOthers}
            >
              Chiudi sessioni
            </Button>
          </footer>
        </Panel>
      )}
      {closeGuard.dialog}
      {pendingLock && (
        <Panel
          variant="alert"
          title="Blocca vault"
          busy={busy}
          error={error}
          onClose={() => setPendingLock(false)}
        >
          <AlertDialogDescription>
            Bloccare il vault e chiudere tutte le {tabs.length} sessioni,
            incluse le shell locali?
          </AlertDialogDescription>
          <footer>
            <Button
              variant="default"
              type="button"
              className="primary"
              disabled={busy}
              onClick={lockVault}
            >
              Chiudi sessioni e blocca
            </Button>
          </footer>
        </Panel>
      )}
    </>
  );
}
