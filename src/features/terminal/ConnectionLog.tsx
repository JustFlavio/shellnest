import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logText } from "./connection-log.ts";
import type { LogEntry } from "./connection-log.ts";
import { ConnectionLogRow } from "./ConnectionLogRow";
import { useCopied } from "./useCopied";
import { useStickToBottom } from "./useStickToBottom";

/** The connection log, folded away until asked for. It lives in memory only, never in storage. */
export function ConnectionLog({ lines }: { lines: LogEntry[] }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  const { copied, copy } = useCopied();
  const { ref, onScroll } = useStickToBottom<HTMLOListElement>(
    shown ? lines.length : -1,
  );
  if (!lines.length) return null;
  return (
    <div className="mt-[12px]">
      <Button
        variant="ghost"
        aria-expanded={shown}
        onClick={() => setShown(!shown)}
      >
        {shown
          ? t("terminal.connectionLog.hideLog")
          : t("terminal.connectionLog.showLog")}
      </Button>
      {shown && (
        <div className="relative mt-[8px]">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("terminal.connectionLog.copyLog")}
            title={t("terminal.connectionLog.copyLog")}
            onClick={() => void copy(logText(lines))}
            className="absolute top-[6px] right-[6px]"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <span role="status" className="sr-only">
            {copied ? t("terminal.connectionLog.logCopied") : ""}
          </span>
          <ol
            ref={ref}
            onScroll={onScroll}
            aria-label={t("terminal.connectionLog.connectionLog")}
            className="m-0 max-h-[200px] list-none overflow-auto rounded-[10px] bg-muted p-[8px] pr-[40px] text-left font-mono text-[12px]"
          >
            {lines.map((entry, i) => (
              <ConnectionLogRow key={i} entry={entry} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
