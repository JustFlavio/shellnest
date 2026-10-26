import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Panel } from "./Editors";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Switch } from "./components/ui/switch";
import { ShortcutsEditor } from "./ShortcutsEditor";
import { cn } from "./lib/utils";
import { help, muted } from "./editor-ui";
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  TERMINAL_THEMES,
  clampFontSize,
  type AppSettings,
} from "./settings.mjs";
import type { Binding, Combo } from "./shortcuts.mjs";
import pkg from "../package.json";

export type SettingsSection = "vault" | "terminal" | "shortcuts";
const sections: { id: SettingsSection; label: string }[] = [
  { id: "vault", label: "Vault" },
  { id: "terminal", label: "Terminale" },
  { id: "shortcuts", label: "Scorciatoie" },
];

export const card = "rounded-[12px] bg-card p-[16px]";
export const cardTitle = "mb-[6px] text-[13px] font-semibold text-foreground";
const row =
  "flex items-center justify-between gap-[16px] border-t border-border py-[11px] first:border-t-0 text-[13px]";
export const soon =
  "ml-[8px] rounded-[6px] border border-input px-[6px] py-[1px] align-middle text-[11px] font-normal text-muted-foreground";

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={row}>
      <div className="min-w-0">
        <div>{label}</div>
        {hint && (
          <div className="mt-[2px] text-[12px] text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

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

function TerminalSettings({
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
          <div className="flex items-center gap-[6px]">
            <Button
              variant="outline"
              size="icon-sm"
              type="button"
              aria-label="Riduci testo"
              disabled={settings.fontSize <= MIN_FONT_SIZE}
              onClick={() =>
                set("fontSize", clampFontSize(settings.fontSize - 1))
              }
            >
              <Minus size={14} />
            </Button>
            <span
              className="w-[28px] text-center tabular-nums"
              aria-live="polite"
            >
              {settings.fontSize}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              type="button"
              aria-label="Ingrandisci testo"
              disabled={settings.fontSize >= MAX_FONT_SIZE}
              onClick={() =>
                set("fontSize", clampFontSize(settings.fontSize + 1))
              }
            >
              <Plus size={14} />
            </Button>
          </div>
        </Row>
        <div className="border-t border-border pt-[11px] text-[13px]">
          <div className="mb-[10px]">Tema colori</div>
          <div
            className="grid grid-cols-2 gap-[8px]"
            role="radiogroup"
            aria-label="Tema colori"
          >
            {TERMINAL_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={settings.terminalTheme === t.id}
                onClick={() => set("terminalTheme", t.id)}
                className={cn(
                  "flex items-center gap-[10px] rounded-[10px] border p-[8px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  settings.terminalTheme === t.id
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-accent",
                )}
              >
                <span
                  className="grid h-[34px] w-[52px] shrink-0 content-center gap-[3px] rounded-[6px] border border-border px-[6px]"
                  style={{ background: t.colors.background }}
                  aria-hidden
                >
                  <i
                    className="block h-[3px] w-[70%] rounded-full"
                    style={{ background: t.colors.foreground }}
                  />
                  <i
                    className="block h-[3px] w-[45%] rounded-full"
                    style={{ background: t.colors.green ?? t.colors.cursor }}
                  />
                  <i
                    className="block h-[3px] w-[30%] rounded-full"
                    style={{ background: t.colors.cursor }}
                  />
                </span>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </section>
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
        <Row
          label="Righe di scrollback"
          hint="Da 500 a 100000. Vale anche per i terminali già aperti."
        >
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
                set(
                  "scrollback",
                  Math.min(100000, Math.max(500, Math.round(n))),
                );
            }}
          />
        </Row>
      </section>
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

export function SettingsDialog({
  section,
  onSection,
  onClose,
  error,
  busy,
  vault,
  settings,
  onSettings,
  bindings,
  overrides,
  onOverrides,
  mac,
}: {
  section: SettingsSection;
  onSection: (s: SettingsSection) => void;
  onClose: () => void;
  error: string;
  busy: boolean;
  vault: ReactNode;
  settings: AppSettings;
  onSettings: (next: AppSettings) => void;
  bindings: Binding[];
  overrides: Record<string, Combo[]>;
  onOverrides: (next: Record<string, Combo[]>) => void;
  mac: boolean;
}) {
  const disabledItem =
    "flex h-[34px] items-center justify-between rounded-lg px-[12px] text-[13px] text-muted-foreground opacity-70";
  return (
    <Panel
      variant="dialog"
      title="Impostazioni"
      className="w-[860px] sm:max-w-[calc(100vw-32px)]"
      busy={false}
      error=""
      onClose={onClose}
    >
      <div className="-m-[16px] flex h-[min(620px,calc(100dvh-140px))] min-h-0">
        <nav
          aria-label="Sezioni delle impostazioni"
          className="flex w-[200px] shrink-0 flex-col gap-[2px] border-r border-border p-[10px]"
        >
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={section === s.id ? "page" : undefined}
              onClick={() => onSection(s.id)}
              className={cn(
                "h-[34px] rounded-lg px-[12px] text-left text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                section === s.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
          <div className="mt-auto grid gap-[2px] border-t border-border pt-[10px]">
            <span className={disabledItem} aria-disabled="true">
              Documentazione<span className={soon}>Presto</span>
            </span>
            <span className={disabledItem} aria-disabled="true">
              Changelog<span className={soon}>Presto</span>
            </span>
            <span className="px-[12px] pt-[6px] text-[12px] text-muted-foreground">
              Shellnest {pkg.version}
            </span>
          </div>
        </nav>
        <div
          className="min-w-0 flex-1 overflow-auto p-[16px]"
          inert={busy ? true : undefined}
        >
          {error && (
            <p role="alert" className="mb-[12px] text-destructive">
              {error}
            </p>
          )}
          {section === "vault" && vault}
          {section === "terminal" && (
            <TerminalSettings
              settings={settings}
              onChange={onSettings}
              mac={mac}
            />
          )}
          {section === "shortcuts" && (
            <ShortcutsEditor
              bindings={bindings}
              overrides={overrides}
              mac={mac}
              onChange={onOverrides}
              onResetAll={() => onOverrides({})}
            />
          )}
          {section === "terminal" && (
            <p className={help}>
              Le modifiche si applicano subito e restano salvate su questo
              dispositivo.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
