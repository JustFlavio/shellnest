import { cn } from "@/lib/utils";
import { TERMINAL_THEMES, type AppSettings } from "./settings.ts";

export function ThemePicker({
  value,
  onChange,
}: {
  value: AppSettings["terminalTheme"];
  onChange: (theme: AppSettings["terminalTheme"]) => void;
}) {
  return (
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
            aria-checked={value === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center gap-[10px] rounded-[10px] border p-[8px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              value === t.id
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
  );
}
