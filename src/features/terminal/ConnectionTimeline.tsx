import { useState } from "react";
import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { help } from "@/lib/editor-ui";
import type { TerminalTab } from "@/lib/types";
import { useApp } from "@/app/app-context";
import { ConnectionLog } from "./ConnectionLog";
import { FingerprintCard } from "./FingerprintCard";
import { PasswordStep } from "./PasswordStep";
import { QuickMethodStep } from "./QuickMethodStep";
import { QuickUserStep } from "./QuickUserStep";
import type { PasswordAsk } from "./useTerminalSession";
import { targetLabel, timelineSteps } from "./connection-steps.ts";
import { needsMethod } from "./quick-setup.ts";
import { useQuickSetup } from "./useQuickSetup";
import type { StepNote, StepState } from "./connection-steps.ts";

const dot: Record<StepState, string> = {
  done: "border-primary bg-primary text-primary-foreground",
  warning: "border-primary bg-background text-primary",
  current: "border-primary text-primary",
  failed: "border-destructive bg-destructive text-background",
  pending: "border-border text-transparent",
};

/** Shown in place of the terminal until the session opens: the steps of the connection, or what went wrong. */
export function ConnectionTimeline({
  tab,
  phase,
  logs,
  details,
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
  details: Record<string, StepNote>;
  failure: string;
  password: PasswordAsk | null;
  onPassword: (password: string) => void;
  onCancel: () => void;
  onRetry: () => void;
  onEdit?: () => void;
}) {
  const {
    vault: { view, busy },
    tabs: { trust, finishQuick },
  } = useApp();
  // Whether this pane had to ask for the host key: decided once, when it opened.
  const [askedTrust] = useState(
    (tab.kind === "ssh" && !tab.host.fingerprint) || tab.kind === "quick",
  );
  const quick = useQuickSetup(
    tab.kind === "quick" ? tab.target.address : "",
    tab.username,
  );
  // A quick connection asks for user and login here until it has them.
  const asking = tab.kind === "quick" && !tab.target.login;
  const target =
    tab.kind === "ssh" ? tab.host : tab.kind === "quick" ? tab.target : null;
  const message = failure || tab.error || "";
  const awaitingTrust =
    ((tab.kind === "ssh" && !tab.host.fingerprint) ||
      (tab.kind === "quick" && !asking && !tab.target.expectedFingerprint)) &&
    !message;
  const chosen = view.identities.find((i) => i.id === quick.setup.identityId);
  const quickDetails: Record<string, StepNote> =
    tab.kind === "quick" && (!asking || quick.stage === "method")
      ? {
          user: {
            text: chosen
              ? `${quick.setup.username} · identità “${chosen.name}”`
              : quick.setup.username,
            warn: false,
          },
          ...(asking && quick.stage !== "method"
            ? {}
            : tab.kind === "quick" && tab.target.login?.kind !== "identity"
              ? {
                  method: {
                    text:
                      quick.setup.method === "key"
                        ? `Chiave “${view.keys.find((k) => k.id === quick.setup.keyId)?.name ?? ""}”`
                        : "Password",
                    warn: false,
                  },
                }
              : {}),
        }
      : {};
  const steps = timelineSteps({
    kind: tab.kind,
    target: target ? targetLabel(target.address, target.port) : "",
    askedTrust,
    awaitingTrust,
    phase,
    failure: message,
    opened: false,
    passwords: password?.asks ?? 0,
    details: { ...quickDetails, ...details },
    setup:
      tab.kind === "quick"
        ? {
            stage: asking ? quick.stage : null,
            method: asking
              ? needsMethod(quick.setup)
              : tab.target.login?.kind !== "identity",
          }
        : undefined,
  });
  const lines = tab.error && !logs.length ? [tab.error] : logs;
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-[24px]">
      <div className="w-[min(100%,460px)]">
        <h2 className="mb-[20px] text-[18px] font-semibold">{tab.title}</h2>
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
                  {step.state === "warning" && (
                    <TriangleAlert size={12} strokeWidth={3} />
                  )}
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
                      : step.state === "warning"
                        ? " — completato con avviso"
                        : step.state === "failed"
                          ? " — non riuscito"
                          : ""}
                  </span>
                </div>
                {step.detail && (
                  <p
                    className={cn(
                      help,
                      "mt-[2px]",
                      step.state === "warning" && "text-primary",
                    )}
                  >
                    {step.detail}
                  </p>
                )}
                {step.state === "current" &&
                  step.id.startsWith("password") &&
                  password?.waiting && (
                    <PasswordStep
                      key={password.asks}
                      refused={password.refused}
                      onSubmit={onPassword}
                      onCancel={onCancel}
                    />
                  )}
                {step.state === "current" && step.id === "user" && (
                  <QuickUserStep
                    state={quick}
                    identities={view.identities}
                    busy={busy}
                    onSubmit={(save) => finishQuick(tab, quick.setup, save)}
                    onCancel={onCancel}
                  />
                )}
                {step.state === "current" && step.id === "method" && (
                  <QuickMethodStep
                    state={quick}
                    keys={view.keys}
                    busy={busy}
                    onSubmit={(save) => finishQuick(tab, quick.setup, save)}
                    onCancel={onCancel}
                  />
                )}
                {step.state === "current" &&
                  step.id !== "trust" &&
                  step.id !== "user" &&
                  step.id !== "method" &&
                  !(step.id.startsWith("password") && password?.waiting) && (
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
          <div className="mt-[20px] flex flex-wrap gap-[8px]">
            <Button onClick={onRetry}>Ricomincia</Button>
            {onEdit && (
              <Button variant="outline" onClick={onEdit}>
                Modifica host
              </Button>
            )}
            <Button variant="outline" onClick={onCancel}>
              Chiudi
            </Button>
          </div>
        )}
        <ConnectionLog lines={lines} />
      </div>
    </div>
  );
}
