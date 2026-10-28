import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { fingerprint, help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export const compareHint = "terminal.fingerprintCard.compareTheFingerprintWith";

/** The host key of a first access, inside the timeline: an explicit answer, never automatic. */
export function FingerprintCard({ value }: { value: string }) {
  const { t } = useTranslation();
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
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape bubbles up from the focused button
    <div
      className="mt-[10px] rounded-[10px] border border-border bg-card p-[14px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          rejectTrust();
        }
      }}
    >
      <p className={help + " mt-0"}>{t(compareHint)}</p>
      <code className={fingerprint + " mt-[10px]"}>{value}</code>
      <div className="mt-[12px] flex flex-wrap justify-end gap-[8px]">
        <Button
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={rejectTrust}
        >
          {t("vault.deleteVaultDialog.cancel")}
        </Button>
        <Button
          ref={approve}
          type="button"
          disabled={busy}
          onClick={approveTrust}
        >
          {t("terminal.fingerprintCard.fingerprintVerifiedConnect")}
        </Button>
      </div>
    </div>
  );
}
