import { Panel } from "./Editors";
import { Button } from "./components/ui/button";
import { fingerprint, help } from "./editor-ui";
import { useApp } from "./app-context";

export function TrustDialog() {
  const {
    vault: { busy, error, setError },
    tabs: { trust, approveTrust, rejectTrust },
  } = useApp();
  if (!trust) return null;
  return (
    <Panel
      variant="dialog"
      title="Verifica identità del server"
      busy={busy}
      error={error}
      onClose={() => {
        rejectTrust();
        setError("");
      }}
    >
      <p>
        Primo accesso a{" "}
        <strong>
          {trust.host?.address ?? trust.quick?.address}:
          {trust.host?.port ?? trust.quick?.port}
        </strong>
        .
      </p>
      <p className={help}>
        Confronta questa impronta con quella fornita dall’amministratore o dalla
        console del server prima di inviare le credenziali.
      </p>
      <code className={fingerprint}>{trust.fingerprint}</code>
      <footer>
        <Button
          autoFocus
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={rejectTrust}
        >
          Annulla
        </Button>
        <Button
          variant="default"
          type="button"
          className="primary"
          disabled={busy}
          onClick={approveTrust}
        >
          Impronta verificata, connetti
        </Button>
      </footer>
    </Panel>
  );
}
