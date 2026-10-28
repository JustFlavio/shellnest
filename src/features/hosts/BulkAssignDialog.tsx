import { useTranslation } from "react-i18next";
import { Panel } from "./Panel";
import { HostSummary } from "./HostSummary";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { muted } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function BulkAssignDialog() {
  const { t } = useTranslation();
  const {
    vault: { view, busy, error },
    library: {
      selected,
      bulkIdentity,
      setBulkIdentity,
      bulkOpen,
      setBulkOpen,
      closeBulkAssign,
      assignIdentity,
    },
  } = useApp();
  if (!bulkOpen) return null;
  return (
    <Panel
      variant="dialog"
      title={t("hosts.bulkAssignDialog.assignIdentity")}
      busy={busy}
      error={error}
      onClose={closeBulkAssign}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          assignIdentity();
        }}
      >
        <p className={muted}>
          {t("hosts.bulkAssignDialog.sessionsAlreadyOpenStay")}
        </p>
        <HostSummary
          hosts={view.hosts.filter((host) => selected.has(host.id))}
          identities={view.identities}
        />
        <label>
          {t("hosts.bulkAssignDialog.identity")}
          <SelectField
            aria-label={t("hosts.bulkAssignDialog.identityToAssign")}
            autoFocus
            required
            value={bulkIdentity}
            onValueChange={setBulkIdentity}
            placeholder={t("hosts.bulkAssignDialog.selectAnIdentity")}
            options={view.identities.map((i) => ({
              value: i.id,
              label: i.name + " — " + i.username,
            }))}
          />
        </label>
        <footer>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setBulkOpen(false)}
            disabled={busy}
          >
            {t("vault.deleteVaultDialog.cancel")}
          </Button>
          <Button
            variant="default"
            type="submit"
            className="primary"
            disabled={busy || !bulkIdentity}
          >
            {t("hosts.bulkAssignDialog.assignToHosts", {
              count: selected.size,
            })}
          </Button>
        </footer>
      </form>
    </Panel>
  );
}
