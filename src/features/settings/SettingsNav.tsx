import { cn } from "@/lib/utils";
import { soon } from "./settings-ui";
import pkg from "../../../package.json";

export type SettingsSection = "vault" | "terminal" | "shortcuts";
const sections: { id: SettingsSection; label: string }[] = [
  { id: "vault", label: "Vault" },
  { id: "terminal", label: "Terminale" },
  { id: "shortcuts", label: "Scorciatoie" },
];
const disabledItem =
  "flex h-[34px] items-center justify-between rounded-lg px-[12px] text-[13px] text-muted-foreground opacity-70";

export function SettingsNav({
  section,
  onSection,
}: {
  section: SettingsSection;
  onSection: (s: SettingsSection) => void;
}) {
  return (
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
  );
}
