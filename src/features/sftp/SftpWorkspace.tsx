import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import type { TerminalTab } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { translateMessage } from "@/i18n/message";
import { useLatest } from "@/lib/useLatest";
import { PasswordStep } from "@/features/terminal/PasswordStep";
import { FilePane } from "./FilePane";
import { TransferQueue } from "./TransferQueue";
import { useFileBrowser } from "./useFileBrowser";
import { useSftpSession } from "./useSftpSession";
import type { FileEntry, Side } from "./types";

export function SftpWorkspace({ tab }: { tab: TerminalTab }) {
  const { t } = useTranslation();
  const session = useSftpSession(tab);
  const local = useFileBrowser(session.invoke, "local", session.ready);
  const remote = useFileBrowser(session.invoke, "remote", session.ready);
  const browsers = useLatest({ local, remote });
  const [ratio, setRatio] = useState(50);
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!session.revision) return;
    void browsers.current.local.refresh();
    void browsers.current.remote.refresh();
  }, [session.revision, browsers]);
  const transfer = (side: Side, entries: FileEntry[]) => {
    const destination = (side === "local" ? remote : local).directory?.path;
    if (session.ready && destination)
      session.enqueue(side, entries, destination);
  };
  if (!session.ready)
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-6">
        <h2 className="text-sm font-medium">
          {t("sftp.connectingTo", { name: tab.title })}
        </h2>
        {session.error && (
          <p role="alert" className="mt-3 max-w-lg text-sm text-destructive">
            {translateMessage(session.error, "error")}
          </p>
        )}
        {session.password ? (
          <PasswordStep
            key={session.password.attempt}
            refused={session.password.refused}
            onSubmit={session.submitPassword}
            onCancel={() => void session.invoke("sftp_close")}
          />
        ) : session.closed ? (
          <Button className="mt-4" variant="outline" onClick={session.retry}>
            {t("sftp.retry")}
          </Button>
        ) : (
          <LoaderCircle
            aria-label={t("sftp.connecting")}
            className="mt-4 animate-spin text-muted-foreground"
            size={20}
          />
        )}
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
      {session.error && (
        <p role="alert" className="px-3 py-2 text-xs text-destructive">
          {translateMessage(session.error, "error")}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          ref={area}
          className="grid h-full min-w-[560px]"
          style={{
            gridTemplateColumns: `minmax(0, ${ratio}fr) 8px minmax(0, ${100 - ratio}fr)`,
          }}
        >
          <FilePane
            side="local"
            title={t("sftp.local")}
            browser={local}
            ready={session.ready}
            sessionKey={tab.id}
            onTransfer={(entries) => transfer("local", entries)}
            onDrop={(side, paths) =>
              transfer(
                side,
                remote.directory?.entries.filter((e) =>
                  paths.includes(e.path),
                ) ?? [],
              )
            }
          />
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- WAI-ARIA window splitter is a focusable separator controlled by arrows */}
          <div
            role="separator"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WAI-ARIA window splitter requires keyboard focus
            tabIndex={0}
            aria-label={t("sftp.resize")}
            aria-orientation="vertical"
            aria-valuemin={20}
            aria-valuemax={80}
            aria-valuenow={ratio}
            className="cursor-col-resize border-x border-border bg-muted/30 hover:bg-primary/20 focus-visible:bg-primary/30 focus-visible:outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                setRatio((v) =>
                  Math.max(
                    20,
                    Math.min(80, v + (e.key === "ArrowLeft" ? -2 : 2)),
                  ),
                );
              }
            }}
            onPointerDown={(e) =>
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            onPointerMove={(e) => {
              if (
                e.currentTarget.hasPointerCapture(e.pointerId) &&
                area.current
              ) {
                const rect = area.current.getBoundingClientRect();
                setRatio(
                  Math.max(
                    20,
                    Math.min(80, ((e.clientX - rect.left) / rect.width) * 100),
                  ),
                );
              }
            }}
            onPointerUp={(e) =>
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          />
          <FilePane
            side="remote"
            title={tab.title}
            browser={remote}
            ready={session.ready}
            sessionKey={tab.id}
            onTransfer={(entries) => transfer("remote", entries)}
            onDrop={(side, paths) =>
              transfer(
                side,
                local.directory?.entries.filter((e) =>
                  paths.includes(e.path),
                ) ?? [],
              )
            }
          />
        </div>
      </div>
      <TransferQueue session={session} />
    </div>
  );
}
