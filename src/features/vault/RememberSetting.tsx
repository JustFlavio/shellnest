import { Switch } from "@/components/ui/switch";
import { Row, card, cardTitle } from "@/features/settings/SettingsDialog";

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
        hint="La chiave resta nel portachiavi di sistema: all’avvio il vault si apre senza password. “Blocca vault” la richiede comunque finché non riavvii l’app."
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
