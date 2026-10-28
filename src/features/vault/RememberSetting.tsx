import { Switch } from "@/components/ui/switch";
import { Row } from "@/features/settings/Row";
import { card, cardTitle } from "@/features/settings/settings-ui";

export function RememberSetting({
  vaultName,
  remembered,
  onRemember,
}: {
  vaultName: string;
  remembered: boolean;
  onRemember: (enabled: boolean) => void;
}) {
  return (
    <section className={card}>
      <h3 className={cardTitle}>Sblocco · {vaultName}</h3>
      <Row
        label="Ricorda su questo dispositivo"
        hint="La chiave resta nel portachiavi di sistema. “Blocca vault” chiede comunque la password."
      >
        <Switch
          label="Ricorda su questo dispositivo"
          checked={remembered}
          onChange={onRemember}
        />
      </Row>
    </section>
  );
}
