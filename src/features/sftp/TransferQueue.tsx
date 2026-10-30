import { useTranslation } from "react-i18next";
import { X, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateMessage } from "@/i18n/message";
import { bytes } from "./file-state.ts";
import type { useSftpSession } from "./useSftpSession";

export function TransferQueue({
  session,
}: {
  session: ReturnType<typeof useSftpSession>;
}) {
  const { t } = useTranslation();
  if (!session.queue.length) return null;
  return (
    <section
      className="max-h-[210px] shrink-0 overflow-auto border-t border-border bg-card/50"
      aria-label={t("sftp.transfers")}
    >
      <header className="sticky top-0 flex items-center justify-between bg-card px-3 py-1 text-xs">
        <span>{t("sftp.transfers")}</span>
        <Button size="sm" variant="ghost" onClick={session.clear}>
          {t("sftp.clearFinished")}
        </Button>
      </header>
      <ul className="divide-y divide-border">
        {session.queue.map((item) => (
          <li key={item.id} className="px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              {item.request.side === "local" ? (
                <Upload size={14} />
              ) : (
                <Download size={14} />
              )}
              <span
                className="min-w-0 flex-1 truncate font-mono"
                title={`${item.current} → ${item.request.destination}`}
              >
                {item.current}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {bytes(item.bytes)} · {t(`sftp.status.${item.status}`)}
              </span>
              {["running", "queued", "conflict"].includes(item.status) && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("sftp.cancelTransfer")}
                  onClick={() => session.cancel(item.id)}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
            {item.error && (
              <p className="mt-1 text-destructive" role="status">
                {translateMessage(item.error, "error")}
              </p>
            )}
            {item.status === "conflict" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>{t("sftp.conflictHint")}</span>
                {(["replace", "skip", "keepBoth"] as const).map((choice) => (
                  <Button
                    key={choice}
                    size="sm"
                    variant="outline"
                    onClick={() => session.resolve(item.id, choice)}
                  >
                    {t(`sftp.${choice}`)}
                  </Button>
                ))}
              </div>
            )}
            {item.status === "failed" && session.ready && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => session.resolve(item.id, "ask")}
              >
                {t("sftp.retry")}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
