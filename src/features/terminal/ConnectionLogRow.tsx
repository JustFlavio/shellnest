import {
  CircleAlert,
  CircleCheck,
  Cpu,
  Fingerprint,
  KeyRound,
  Network,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  KIND_LABEL,
  formatOffset,
  logKind,
  logSegments,
} from "./connection-log.ts";
import type { LogEntry, LogKind } from "./connection-log.ts";

const icons: Record<LogKind, ComponentType<{ className?: string }>> = {
  network: Network,
  fingerprint: Fingerprint,
  auth: KeyRound,
  tech: Cpu,
  error: CircleAlert,
  success: CircleCheck,
};

/** One event of the connection log: when, what kind (icon and hidden label), and the line itself. */
export function ConnectionLogRow({ entry }: { entry: LogEntry }) {
  const kind = logKind(entry.text);
  const Icon = icons[kind];
  return (
    <li
      className={cn(
        "flex items-baseline gap-[8px] rounded-[6px] px-[6px] py-[1px] leading-[18px]",
        kind === "tech" && "text-[11px] text-muted-foreground",
        kind === "error" && "bg-destructive/10 font-medium text-destructive",
      )}
    >
      <span className="w-[62px] shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
        {formatOffset(entry.at)}
      </span>
      <Icon
        aria-hidden
        className={cn(
          "size-[12px] shrink-0 translate-y-[2px] text-muted-foreground",
          kind === "success" && "text-primary",
          kind === "error" && "text-destructive",
        )}
      />
      <span className="sr-only">{KIND_LABEL[kind]}: </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {logSegments(entry.text, kind).map((part, i) =>
          part.strong ? (
            <strong key={i} className="font-semibold text-primary">
              {part.text}
            </strong>
          ) : (
            part.text
          ),
        )}
      </span>
    </li>
  );
}
