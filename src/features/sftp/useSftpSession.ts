import { useCallback, useEffect, useState } from "react";
import { Channel } from "@tauri-apps/api/core";
import { useApp } from "@/app/app-context";
import { desktop } from "@/lib/platform";
import { useLatest } from "@/lib/useLatest";
import { toMessage } from "@/i18n/message";
import type { TerminalTab } from "@/lib/types";
import type { Message } from "@/i18n/message";
import { TransferQueue } from "./transfer-queue.ts";
import type { SftpEvent, Transfer } from "./types";

export function useSftpSession(tab: TerminalTab) {
  const { vault, tabs } = useApp();
  const command = useLatest(vault.invokeCommand);
  const status = useLatest(tabs.filesStatus);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [ready, setReady] = useState(false),
    [closed, setClosed] = useState(false);
  const [error, setError] = useState<Message | null>(null);
  const [password, setPassword] = useState<{
    refused: boolean;
    attempt: number;
  } | null>(null);
  const [queue, setQueue] = useState<Transfer[]>([]);
  const [revision, setRevision] = useState(0);
  const invoke = useCallback(
    <T>(name: string, args: Record<string, unknown> = {}) =>
      command.current<T>(name, { ...args, vaultId: tab.vaultId, sessionId }),
    [command, tab.vaultId, sessionId],
  );
  const api = useLatest(invoke);
  const [transfers] = useState(
    () =>
      new TransferQueue(
        (request) => api.current("sftp_transfer", { request }),
        (id) => api.current("sftp_cancel", { id }),
        setQueue,
        toMessage,
      ),
  );
  const target = useLatest(tab);
  useEffect(() => {
    let disposed = false;
    const handle = (event: SftpEvent) => {
      if (disposed) return;
      if (event.type === "ready") {
        setReady(true);
        transfers.connected();
        status.current(tab.id, "connected");
      }
      if (event.type === "error") setError(event.data);
      if (event.type === "password")
        setPassword((old) => ({
          refused: event.data,
          attempt: (old?.attempt ?? 0) + 1,
        }));
      if (event.type === "closed") {
        setReady(false);
        setClosed(true);
        setPassword(null);
        status.current(tab.id, "closed");
        transfers.disconnected();
      }
      if (event.type === "transfer") {
        transfers.progress(event.data);
        if (event.data.status !== "running") setRevision((n) => n + 1);
      }
    };
    const output = desktop ? new Channel<SftpEvent>() : { onmessage: handle };
    output.onmessage = handle;
    const current = target.current;
    const args =
      current.kind === "ssh"
        ? {
            target: {
              kind: "saved",
              id: current.host.id,
              expected: {
                address: current.host.address,
                port: current.host.port,
                username: current.username,
                fingerprint: current.host.fingerprint,
              },
            },
          }
        : current.kind === "quick"
          ? { target: { kind: "quick", ...current.target } }
          : {};
    status.current(tab.id, "connecting");
    const opening = invoke("sftp_connect", { ...args, output });
    void opening
      .then(() => {
        if (disposed) void invoke("sftp_close").catch(() => {});
      })
      .catch((e) => {
        if (!disposed) {
          setError(toMessage(e));
          setClosed(true);
          status.current(tab.id, "failed");
        }
      });
    return () => {
      disposed = true;
      transfers.disconnected();
      void invoke("sftp_close").catch(() => {});
    };
  }, [invoke, target, tab.id, status, transfers]);
  const retry = () => {
    setReady(false);
    setClosed(false);
    setError(null);
    setPassword(null);
    transfers.disconnected();
    setSessionId(crypto.randomUUID());
  };
  const submitPassword = (value: string) => {
    setPassword(null);
    void invoke("sftp_password", { password: value }).catch((e) =>
      setError(toMessage(e)),
    );
  };
  return {
    invoke,
    ready,
    closed,
    error,
    password,
    submitPassword,
    retry,
    queue,
    revision,
    enqueue: transfers.enqueue.bind(transfers),
    resolve: transfers.resolve.bind(transfers),
    cancel: (id: string) =>
      void transfers.cancel(id).catch((e) => setError(toMessage(e))),
    clear: transfers.clear.bind(transfers),
  };
}
