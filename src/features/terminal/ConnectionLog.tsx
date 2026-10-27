import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopied } from "./useCopied";

/** The connection log, folded away until asked for. It lives in memory only, never in storage. */
export function ConnectionLog({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState(false);
  const { copied, copy } = useCopied();
  if (!lines.length) return null;
  return (
    <div className="mt-[12px]">
      <Button
        variant="ghost"
        aria-expanded={shown}
        onClick={() => setShown(!shown)}
      >
        {shown ? "Nascondi log" : "Mostra log"}
      </Button>
      {shown && (
        <div className="relative mt-[8px]">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copia log"
            title="Copia log"
            onClick={() => void copy(lines.join("\n"))}
            className="absolute top-[6px] right-[6px]"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <span role="status" className="sr-only">
            {copied ? "Log copiato." : ""}
          </span>
          <pre
            aria-label="Log della connessione"
            className="max-h-[200px] overflow-auto rounded-[10px] bg-muted p-[14px] pr-[40px] text-left text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]"
          >
            {lines.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
