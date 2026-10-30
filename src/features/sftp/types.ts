import type { Message } from "@/i18n/message";

export type Side = "local" | "remote";
export type FileEntry = {
  name: string;
  path: string;
  kind: "file" | "directory" | "symlink" | "other";
  size: number | null;
  modified: number | null;
  hidden: boolean;
};
export type Directory = {
  path: string;
  parent: string | null;
  roots: string[];
  entries: FileEntry[];
};
export type Mutation =
  | { type: "mkdir"; parent: string; name: string }
  | { type: "rename"; path: string; name: string }
  | { type: "delete"; paths: string[] };
export type Conflict = "ask" | "replace" | "skip" | "keepBoth";
export type TransferRequest = {
  id: string;
  side: Side;
  source: string;
  destination: string;
  conflict: Conflict;
};
export type TransferProgress = {
  id: string;
  status: "running" | "completed" | "cancelled" | "failed" | "conflict";
  bytes: number;
  current: string;
  error: Message | null;
};
export type Transfer = Omit<TransferProgress, "status"> & {
  request: TransferRequest;
  status: TransferProgress["status"] | "queued";
};
export type SftpEvent =
  | { type: "ready" | "closed" }
  | { type: "password"; data: boolean }
  | { type: "error"; data: Message }
  | { type: "transfer"; data: TransferProgress };
export type SftpInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;
