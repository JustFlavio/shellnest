import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Row } from "./Row";
import { card, cardTitle } from "./settings-ui";
import type { AppSettings } from "./settings.ts";

export function TerminalBehavior({
  settings,
  set,
  mac,
}: {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  mac: boolean;
}) {
  return (
    <section className={card}>
      <h3 className={cardTitle}>Comportamento</h3>
      <Row label="Copia automaticamente la selezione">
        <Switch
          label="Copia automaticamente la selezione"
          checked={settings.copyOnSelect}
          onChange={(v) => set("copyOnSelect", v)}
        />
      </Row>
      <Row label="Incolla con il tasto destro">
        <Switch
          label="Incolla con il tasto destro"
          checked={settings.rightClickPaste}
          onChange={(v) => set("rightClickPaste", v)}
        />
      </Row>
      <Row label="Suono del bell">
        <Switch
          label="Suono del bell"
          checked={settings.bell}
          onChange={(v) => set("bell", v)}
        />
      </Row>
      {mac && (
        <Row
          label="Usa Option come tasto Meta"
          hint="Lascialo spento sulle tastiere italiane: Option digita @ # [ ]."
        >
          <Switch
            label="Usa Option come tasto Meta"
            checked={settings.optionAsMeta}
            onChange={(v) => set("optionAsMeta", v)}
          />
        </Row>
      )}
      <Row label="Colori vivaci per il testo in grassetto">
        <Switch
          label="Colori vivaci per il testo in grassetto"
          checked={settings.brightBold}
          onChange={(v) => set("brightBold", v)}
        />
      </Row>
      <Row label="Righe di scrollback" hint="Da 500 a 100000.">
        <Input
          className="w-[110px]"
          type="number"
          min={500}
          max={100000}
          step={500}
          aria-label="Righe di scrollback"
          value={settings.scrollback}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n))
              set("scrollback", Math.min(100000, Math.max(500, Math.round(n))));
          }}
        />
      </Row>
    </section>
  );
}
