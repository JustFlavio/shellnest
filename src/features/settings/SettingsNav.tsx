import { cn } from "@/lib/utils";

export type SettingsSection = "vault" | "terminal" | "shortcuts" | "updates";
const sections: { id: SettingsSection; label: string }[] = [
  { id: "vault", label: "Vault" },
  { id: "terminal", label: "Terminale" },
  { id: "shortcuts", label: "Scorciatoie" },
  { id: "updates", label: "Aggiornamenti" },
];

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
    </nav>
  );
}
