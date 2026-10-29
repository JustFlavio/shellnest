import { Trans } from "react-i18next";
import { useTranslation } from "react-i18next";
import { Panel } from "./Panel";
import { HostSummary } from "./HostSummary";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function DeletionDialog() {
  const { t } = useTranslation();
  const {
    vault: { view, busy, error },
    library: { deletion, closeDeletion, confirmDeletion },
  } = useApp();
  if (!deletion) return null;
  const ids = new Set(deletion.ids ?? [deletion.id]);
  return (
    <Panel
      variant="alert"
      title={
        deletion.kind === "hosts"
          ? t("hosts.deletionDialog.deleteHost")
          : deletion.kind === "identities"
            ? t("hosts.collectionTables.deleteIdentity")
            : deletion.kind === "groups"
              ? t("hosts.deletionDialog.deleteGroup")
              : t("hosts.collectionTables.deleteKey")
      }
      busy={busy}
      error={error}
      onClose={closeDeletion}
    >
      <AlertDialogDescription>
        <Trans
          i18nKey="hosts.deletionDialog.deleteFromVault"
          values={{ name: deletion.name }}
          components={{ strong: <strong /> }}
        />
      </AlertDialogDescription>
      <p className={help}>
        {deletion.kind === "hosts"
          ? t("hosts.deletionDialog.linkedIdentitiesAndKeys")
          : deletion.kind === "groups"
            ? t("hosts.deletionDialog.theGroupMustBe")
            : t("hosts.deletionDialog.theItemWillBe")}
      </p>
      {deletion.kind === "hosts" && (
        <HostSummary
          hosts={view.hosts.filter((host) => ids.has(host.id))}
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
          {t("vault.deleteVaultDialog.delete")}
        </Button>
      </footer>
    </Panel>
  );
}
