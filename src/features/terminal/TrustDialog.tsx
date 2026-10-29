import { Trans } from "react-i18next";
import { useTranslation } from "react-i18next";
import { Panel } from "@/features/hosts/Panel";
import { compareHint } from "./FingerprintCard";
import { Button } from "@/components/ui/button";
import { fingerprint, help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function TrustDialog() {
  const { t } = useTranslation();
  const {
    vault: { busy, error, setError },
    tabs: { trust, approveTrust, rejectTrust },
  } = useApp();
  // A trust with a tab is answered inside that pane (ConnectionTimeline).
  if (!trust || trust.tabId) return null;
  return (
    <Panel
      variant="dialog"
      title={t("terminal.trustDialog.verifyTheServerIdentity")}
      busy={busy}
      error={error}
      onClose={() => {
        rejectTrust();
        setError("");
      }}
    >
      <p>
        <Trans
          i18nKey="terminal.trustDialog.firstAccess"
          values={{
            target: `${trust.host?.address ?? trust.quick?.address}:${trust.host?.port ?? trust.quick?.port}`,
          }}
          components={{ strong: <strong /> }}
        />
      </p>
      <p className={help}>{t(compareHint)}</p>
      <code className={fingerprint}>{trust.fingerprint}</code>
      <footer>
        <Button
          autoFocus
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={rejectTrust}
        >
          {t("vault.deleteVaultDialog.cancel")}
        </Button>
        <Button
          variant="default"
          type="button"
          className="primary"
          disabled={busy}
          onClick={approveTrust}
        >
          {t("terminal.fingerprintCard.fingerprintVerifiedConnect")}
        </Button>
      </footer>
    </Panel>
  );
}
