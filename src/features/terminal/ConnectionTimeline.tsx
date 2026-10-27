import { useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { help } from "@/lib/editor-ui";
import type { TerminalTab } from "@/lib/types";
import { useApp } from "@/app/app-context";
import { FingerprintCard } from "./FingerprintCard";
import { PasswordStep } from "./PasswordStep";
import type { PasswordAsk } from "./useTerminalSession";
import { timelineSteps } from "./connection-steps.mjs";
import type { StepState } from "./connection-steps.mjs";

const dot: Record<StepState, string> = {
  done: "border-primary bg-primary text-primary-foreground",
  current: "border-primary text-primary",
  failed: "border-destructive bg-destructive text-background",
  pending: "border-border text-transparent",
};

/** Shown in place of the terminal until the session opens: the steps of the connection, or what went wrong. */
export function ConnectionTimeline({
  tab,
  phase,
  logs,
  failure,
  password,
  onPassword,
  onCancel,
  onRetry,
  onEdit,
}: {
  tab: TerminalTab;
  phase: string;
  logs: string[];
  failure: string;
  password: PasswordAsk | null;
  onPassword: (password: string) => void;
  onCancel: () => void;
  onRetry: () => void;
  onEdit?: () => void;
}) {
  const {
    tabs: { trust },
  } = useApp();
  // Whether this pane had to ask for the host key: decided once, when it opened.
  const [askedTrust] = useState(tab.kind === "ssh" && !tab.host.fingerprint);
  const [showLogs, setShowLogs] = useState(false);
  const [copyError, setCopyError] = useState("");
  const target =
    tab.kind === "ssh" ? tab.host : tab.kind === "quick" ? tab.target : null;
  const message = failure || tab.error || "";
  const awaitingTrust = tab.kind === "ssh" && !tab.host.fingerprint && !message;
  const steps = timelineSteps({
    kind: tab.kind,
    target: target ? `${target.address}:${target.port}` : "",
    askedTrust,
    awaitingTrust,
    phase,
    failure: message,
    opened: false,
    password: password && password.waiting,
  });
  const details = [...logs, ...(tab.error ? [tab.error] : [])].join("\n");
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-[24px]">
      <div className="w-[min(100%,460px)]">
        <h2 className="mb-[2px] text-[18px] font-semibold">{tab.title}</h2>
        <p className={help + " mt-0 mb-[20px]"}>{tab.username}</p>
        <ol
          aria-label="Avanzamento della connessione"
          className="m-0 list-none p-0"
        >
          {steps.map((step, i) => {
            const last = i === steps.length - 1;
            return (
              <li
                key={step.id}
                aria-current={step.state === "current" ? "step" : undefined}
                className="relative pb-[18px] pl-[34px] last:pb-0"
              >
                {!last && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-[22px] bottom-[-2px] left-[10px] w-[2px] -translate-x-1/2 rounded bg-border transition-colors duration-300",
                      step.state === "done" && "bg-primary",
                    )}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 left-0 grid size-[20px] place-items-center rounded-full border-2 bg-background transition-colors duration-300",
                    dot[step.state],
                  )}
                >
                  {step.state === "done" && <Check size={12} strokeWidth={3} />}
                  {step.state === "failed" && <X size={12} strokeWidth={3} />}
                  {step.state === "current" && (
                    <LoaderCircle
                      size={14}
                      className="motion-safe:animate-spin"
                    />
                  )}
                </span>
                <div
                  className={cn(
                    "text-[14px] leading-[20px]",
                    step.state === "pending" && "text-muted-foreground",
                    step.state === "failed" && "text-destructive",
                  )}
                >
                  {step.label}
                  <span className="sr-only">
                    {step.state === "done"
                      ? " — completato"
                      : step.state === "failed"
                        ? " — non riuscito"
                        : ""}
                  </span>
                </div>
                {step.state === "current" &&
                  step.id === "password" &&
                  password?.waiting && (
                    <PasswordStep
                      key={String(password.refused)}
                      refused={password.refused}
                      onSubmit={onPassword}
                      onCancel={onCancel}
                    />
                  )}
                {step.state === "current" &&
                  step.id !== "trust" &&
                  !(step.id === "password" && password?.waiting) && (
                    <p role="status" className={help + " mt-[2px]"}>
                      {phase}
                    </p>
                  )}
                {step.state === "current" &&
                  step.id === "trust" &&
                  (trust ? (
                    <FingerprintCard value={trust.fingerprint} />
                  ) : (
                    <p role="status" className={help + " mt-[2px]"}>
                      Lettura dell’impronta del server…
                    </p>
                  ))}
                {step.state === "failed" && (
                  <p
                    role="alert"
                    className="mt-[4px] text-[13px] leading-[1.6] text-destructive [overflow-wrap:anywhere]"
                  >
                    {message}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {message && (
          <div className="mt-[20px]">
            <div className="flex flex-wrap gap-[8px]">
              <Button onClick={onRetry}>Riprova</Button>
              {onEdit && (
                <Button variant="outline" onClick={onEdit}>
                  Modifica host
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowLogs(!showLogs)}>
                {showLogs ? "Nascondi dettagli" : "Mostra dettagli"}
              </Button>
            </div>
            {showLogs && (
              <>
                <pre className="mt-[12px] max-h-[200px] overflow-auto rounded-[10px] bg-muted p-[14px] text-left text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {details || phase}
                </pre>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(details)
                      .catch(() => setCopyError("Copia non riuscita."))
                  }
                >
                  Copia log
                </Button>
              </>
            )}
            {copyError && <p role="alert">{copyError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
