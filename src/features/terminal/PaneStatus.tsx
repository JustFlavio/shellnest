import { useState } from "react";
import { CircleAlert, LoaderCircle, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { help } from "@/lib/editor-ui";
import type { TerminalTab } from "@/lib/types";

/** Shown in place of the terminal until the session opens: progress, or what went wrong. */
export function PaneStatus({
  tab,
  endpoint,
  phase,
  logs,
  failure,
  pendingTrust,
  onClose,
  onRetry,
  onEdit,
}: {
  tab: TerminalTab;
  endpoint: string;
  phase: string;
  logs: string[];
  failure: string;
  // waiting for the host key to be trusted
  pendingTrust: boolean;
  onClose: () => void;
  onRetry: () => void;
  onEdit?: () => void;
}) {
  const [showLogs, setShowLogs] = useState(false);
  const [copyError, setCopyError] = useState("");
  const message = failure || tab.error;
  const details = [...logs, ...(tab.error ? [tab.error] : [])].join("\n");
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-[24px]">
      <div className="w-[min(100%,460px)] text-center [&>h2]:text-[18px] [&>h2]:font-semibold [&>p]:my-[10px] [&>p]:[overflow-wrap:anywhere] [&>svg]:mx-auto [&>svg]:mb-[16px] [&>svg]:text-primary">
        {message ? (
          <CircleAlert size={32} />
        ) : pendingTrust ? (
          <TerminalSquare size={32} />
        ) : (
          <LoaderCircle size={32} className="animate-spin" />
        )}
        <h2>{tab.title}</h2>
        <p className={help}>{endpoint}</p>
        <p role={message ? "alert" : "status"}>{message || phase}</p>
        <Button variant="ghost" onClick={() => setShowLogs(!showLogs)}>
          {showLogs ? "Nascondi dettagli" : "Mostra dettagli"}
        </Button>
        {showLogs && (
          <pre className="max-h-[240px] overflow-auto rounded-[10px] bg-muted p-[14px] text-left text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]">
            {details || phase}
          </pre>
        )}
        <div className="mt-[20px] flex flex-wrap justify-center gap-[8px]">
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
          {message && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(details)
                    .catch(() => setCopyError("Copia non riuscita."))
                }
              >
                Copia log
              </Button>
              {onEdit && (
                <Button variant="outline" onClick={onEdit}>
                  Modifica host
                </Button>
              )}
              <Button onClick={onRetry}>Riprova</Button>
            </>
          )}
        </div>
        {copyError && <p role="alert">{copyError}</p>}
      </div>
    </div>
  );
}
