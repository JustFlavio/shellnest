
import { Apple, Monitor, TerminalSquare } from "lucide-react";
export function OsIcon({ os }: { os?: string | null }) {
  const name = (os ?? "").toLowerCase();
  if (name.includes("ubuntu"))
    return (
      <span className="os-icon ubuntu" title="Ubuntu">
        <svg viewBox="0 0 32 32" aria-label="Ubuntu">
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
      <span className="os-icon debian" title="Debian">
        <svg viewBox="0 0 32 32" aria-label="Debian">
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
      className={`os-icon ${name ? "detected" : ""}`}
      title={os || "Sistema non ancora rilevato"}
    >
      <Icon size={22} />
    </span>
  );
}
