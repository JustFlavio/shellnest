import { TerminalAppearance } from "./TerminalAppearance";
import { TerminalBehavior } from "./TerminalBehavior";
import type { AppSettings } from "./settings.ts";

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
    </div>
  );
}
