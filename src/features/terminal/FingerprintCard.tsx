import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { fingerprint, help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

/** The host key of a first access, inside the timeline: an explicit answer, never automatic. */
export function FingerprintCard({ value }: { value: string }) {
  const {
    vault: { busy },
    tabs: { approveTrust, rejectTrust },
  } = useApp();
  const approve = useRef<HTMLButtonElement>(null);
  // After a frame: the launcher that opened the pane hands its focus back on close.
  useEffect(() => {
    const frame = requestAnimationFrame(() => approve.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className="mt-[10px] rounded-[10px] border border-border bg-card p-[14px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          rejectTrust();
        }
      }}
    >
      <p className={help + " mt-0"}>
        Confronta questa impronta con quella fornita dall’amministratore o dalla
        console del server prima di inviare le credenziali.
      </p>
      <code className={fingerprint + " mt-[10px]"}>{value}</code>
      <div className="mt-[12px] flex flex-wrap justify-end gap-[8px]">
        <Button
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={rejectTrust}
        >
          Annulla
        </Button>
        <Button
          ref={approve}
          type="button"
          disabled={busy}
          onClick={approveTrust}
        >
          Impronta verificata, connetti
        </Button>
      </div>
    </div>
  );
}
