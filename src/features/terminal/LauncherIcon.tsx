import { LayoutGrid, TerminalSquare, Zap } from "lucide-react";
import { OsIcon } from "@/components/OsIcon";
import type { LauncherResult } from "./launcher-results.ts";

export function LauncherIcon({ result }: { result: LauncherResult }) {
  if (result.kind === "workspace")
    return (
      <span className="grid size-[24px] shrink-0 place-items-center rounded-[6px] bg-success/16 text-success">
        <LayoutGrid size={14} />
      </span>
    );
  if (result.kind === "target" || result.kind === "local")
    return (
      <span className="grid size-[24px] shrink-0 place-items-center rounded-[6px] bg-accent text-muted-foreground">
        {result.kind === "target" ? (
          <Zap size={14} />
        ) : (
          <TerminalSquare size={14} />
        )}
      </span>
    );
  return <OsIcon os={result.os} size="launch" />;
}
