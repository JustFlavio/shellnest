import { Input } from "@/components/ui/input";
import { Row } from "./Row";
import { FontSizeControl } from "./FontSizeControl";
import { ThemePicker } from "./ThemePicker";
import { card, cardTitle } from "./settings-ui";
import type { AppSettings } from "./settings.ts";

const fontSuggestions = [
  "SF Mono",
  "Menlo",
  "Monaco",
  "Cascadia Code",
  "JetBrains Mono",
  "Fira Code",
  "Source Code Pro",
  "Geist Mono",
  "Consolas",
];

export function TerminalAppearance({
  settings,
  set,
}: {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <section className={card}>
      <h3 className={cardTitle}>Aspetto</h3>
      <Row
        label="Font"
        hint="Vuoto per il font predefinito. Usa un font installato."
      >
        <>
          <Input
            className="w-[200px]"
            list="terminal-fonts"
            aria-label="Font del terminale"
            placeholder="Predefinito"
            maxLength={200}
            value={settings.fontFamily}
            onChange={(e) => set("fontFamily", e.target.value)}
          />
          <datalist id="terminal-fonts">
            {fontSuggestions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </>
      </Row>
      <Row label="Dimensione del testo">
        <FontSizeControl
          value={settings.fontSize}
          onChange={(size) => set("fontSize", size)}
        />
      </Row>
      <ThemePicker
        value={settings.terminalTheme}
        onChange={(theme) => set("terminalTheme", theme)}
      />
    </section>
  );
}
