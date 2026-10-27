import { muted } from "@/lib/editor-ui";
import { TerminalAppearance } from "./TerminalAppearance";
import { TerminalBehavior } from "./TerminalBehavior";
import { card, cardTitle, soon } from "./settings-ui";
import type { AppSettings } from "./settings.mjs";

export function TerminalSettings({
  settings,
  onChange,
  mac,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  mac: boolean;
}) {
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    onChange({ ...settings, [key]: value });
  return (
    <div className="grid gap-[16px]">
      <TerminalAppearance settings={settings} set={set} />
      <TerminalBehavior settings={settings} set={set} mac={mac} />
      <section className={card}>
        <h3 className={cardTitle}>
          Evidenziazione parole chiave<span className={soon}>Presto</span>
        </h3>
        <p className={muted}>
          Errori, avvisi, indirizzi IP e MAC colorati direttamente nell’output
          del terminale, con colori a scelta.
        </p>
      </section>
      <section className={card}>
        <h3 className={cardTitle}>
          Connessione<span className={soon}>Presto</span>
        </h3>
        <p className={muted}>
          Keepalive configurabile, riconnessione automatica e shell del
          terminale locale.
        </p>
      </section>
    </div>
  );
}
