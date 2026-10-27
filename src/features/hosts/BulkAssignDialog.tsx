import { Panel } from "./Panel";
import { HostSummary } from "./HostSummary";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { muted } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function BulkAssignDialog() {
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
      title="Assegna identità"
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
          Modifica l’identità di {selected.size} host selezionati. Le sessioni
          già aperte restano attive.
        </p>
        <HostSummary
          hosts={view.hosts.filter((host) => selected.has(host.id))}
          identities={view.identities}
        />
        <label>
          Identità
          <SelectField
            aria-label="Identità da assegnare"
            autoFocus
            required
            value={bulkIdentity}
            onValueChange={setBulkIdentity}
            placeholder="Seleziona un’identità"
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
            Annulla
          </Button>
          <Button
            variant="default"
            type="submit"
            className="primary"
            disabled={busy || !bulkIdentity}
          >
            Assegna a {selected.size} host
          </Button>
        </footer>
      </form>
    </Panel>
  );
}
