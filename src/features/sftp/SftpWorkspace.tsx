import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TerminalTab } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { translateMessage } from "@/i18n/message";
import { useLatest } from "@/lib/useLatest";
import { PasswordStep } from "@/features/terminal/PasswordStep";
import { FilePane } from "./FilePane";
import { TransferQueue } from "./TransferQueue";
import { useFileBrowser } from "./useFileBrowser";
import { useSftpSession } from "./useSftpSession";
import type { FileEntry, Side } from "./types";
import { Alert } from "@/components/ui/alert";

export function SftpWorkspace({ tab }: { tab: TerminalTab }) {
  const { t } = useTranslation();
  const session = useSftpSession(tab);
  const local = useFileBrowser(session.invoke, "local", session.ready);
  const remote = useFileBrowser(session.invoke, "remote", session.ready);
  const browsers = useLatest({ local, remote });
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
          <Alert variant="destructive" className="mt-3 max-w-lg">
            {translateMessage(session.error, "error")}
          </Alert>
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
          <p role="status" className="mt-4 text-muted-foreground">
            <Spinner className="size-5" />
            <span className="sr-only">{t("sftp.connecting")}</span>
          </p>
        )}
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
      {session.error && (
        <Alert
          variant="destructive"
          className="rounded-none border-x-0 border-t-0 px-3 py-2 text-xs"
        >
          {translateMessage(session.error, "error")}
        </Alert>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <ResizablePanelGroup className="min-w-[560px]">
          <ResizablePanel defaultSize="50%" minSize="20%">
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
          </ResizablePanel>
          <ResizableHandle withHandle aria-label={t("sftp.resize")} />
          <ResizablePanel defaultSize="50%" minSize="20%">
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <TransferQueue session={session} />
    </div>
  );
}
