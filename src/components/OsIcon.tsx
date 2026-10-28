import { useTranslation } from "react-i18next";
import { Apple, Monitor, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Box and glyph size per context, in px (the root font is 14px, so no rem units).
const sizes = {
  default: { box: "size-[44px] rounded-[11px]", glyph: "size-[28px]" },
  row: { box: "size-[28px] rounded-[6px]", glyph: "size-[20px]" },
  field: { box: "size-[36px] rounded-[9px]", glyph: "size-[24px]" },
  launch: { box: "size-[24px] rounded-[11px]", glyph: "size-[16px]" },
  tab: { box: "size-[18px] rounded-[4px]", glyph: "size-[12px]" },
};
const base =
  "inline-flex shrink-0 items-center justify-center bg-muted text-muted-foreground";

export function OsIcon({
  os,
  size = "default",
}: {
  os?: string | null;
  size?: keyof typeof sizes;
}) {
  const { t } = useTranslation();
  const name = (os ?? "").toLowerCase();
  const box = cn(base, sizes[size].box);
  const glyph = sizes[size].glyph;
  if (name.includes("ubuntu"))
    return (
      <span className={cn(box, "bg-[#e95420] text-white")} title="Ubuntu">
        <svg viewBox="0 0 32 32" aria-label="Ubuntu" className={glyph}>
          <circle
            cx="16"
            cy="16"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M16 6v5M7 21l5-3M25 21l-5-3"
            stroke="#e65d24"
            strokeWidth="4"
          />
          <circle cx="16" cy="5" r="3" fill="currentColor" />
          <circle cx="6.5" cy="21.5" r="3" fill="currentColor" />
          <circle cx="25.5" cy="21.5" r="3" fill="currentColor" />
        </svg>
      </span>
    );
  if (name.includes("debian"))
    return (
      <span className={cn(box, "bg-[#c90050] text-white")} title="Debian">
        <svg viewBox="0 0 32 32" aria-label="Debian" className={glyph}>
          <path
            d="M22 8c-7-7-18 2-13 10 3 5 12 4 12-2 0-6-9-6-9-1 0 3 5 4 6 1M9 18c0 5 5 8 12 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  const Icon = name.includes("windows")
    ? Monitor
    : name.includes("darwin") || name.includes("mac")
      ? Apple
      : TerminalSquare;
  return (
    <span
      className={cn(box, name && "text-foreground")}
      title={os || t("components.osIcon.systemNotDetectedYet")}
    >
      <Icon className={glyph} />
    </span>
  );
}
