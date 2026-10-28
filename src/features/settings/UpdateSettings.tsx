import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Row } from "./Row";
import { card, cardTitle } from "./settings-ui";
import { statusLine } from "./update-flow.ts";
import type { AppUpdate } from "./useAppUpdate";
import type { AppSettings } from "./settings.ts";
import pkg from "../../../package.json";

export function UpdateSettings({
  settings,
  onChange,
  update,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  update: AppUpdate;
}) {
  const { status } = update;
  const [label, run] =
    status.kind === "available"
      ? ["Scarica", update.download]
      : status.kind === "ready"
        ? ["Riavvia ora", update.restart]
        : ["Controlla ora", update.check];
  return (
    <section className={card}>
      <h3 className={cardTitle}>Aggiornamenti</h3>
      <Row label="Versione installata">
        <span className="text-muted-foreground">Shellnest {pkg.version}</span>
      </Row>
      <Row label="Controlla all’avvio">
        <Switch
          label="Controlla all’avvio"
          checked={settings.checkUpdates}
          onChange={(v) => onChange({ ...settings, checkUpdates: v })}
        />
      </Row>
      <Row label="Stato">
        <div className="flex items-center gap-[12px]">
          <span role="status" className="text-right text-muted-foreground">
            {statusLine(status)}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={update.busy}
            onClick={run}
          >
            {label}
          </Button>
        </div>
      </Row>
    </section>
  );
}
