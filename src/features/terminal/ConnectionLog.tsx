import { useState } from "react";
import { Button } from "@/components/ui/button";

/** The connection log, folded away until asked for. It lives in memory only, never in storage. */
export function ConnectionLog({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState(false);
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
        <pre
          aria-label="Log della connessione"
          className="mt-[8px] max-h-[200px] overflow-auto rounded-[10px] bg-muted p-[14px] text-left text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]"
        >
          {lines.join("\n")}
        </pre>
      )}
    </div>
  );
}
