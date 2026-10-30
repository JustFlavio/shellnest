import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewSftp } from "./sftp.ts";
import type {
  Directory,
  SftpEvent,
  TransferRequest,
} from "../../features/sftp/types.ts";

test("demo file commands expose synthetic navigation, mutation and cancellable copies", async () => {
  const backend = createPreviewSftp();
  const events: SftpEvent[] = [];
  const call = (command: string, args: Record<string, unknown> = {}) =>
    backend.invoke(command, { sessionId: "demo", ...args });
  call("sftp_connect", {
    id: "host",
    output: { onmessage: (e: SftpEvent) => events.push(e) },
  });
  await Promise.resolve();
  assert.equal(events[0].type, "ready");
  call("sftp_mutate", {
    side: "remote",
    mutation: { type: "mkdir", parent: "/root", name: "uploads" },
  });
  const request: TransferRequest = {
    id: "copy",
    side: "local",
    source: "/home/demo/projects",
    destination: "/root/uploads",
    conflict: "ask",
  };
  const finish = async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  };
  call("sftp_transfer", { request });
  await finish();
  const directory = call("sftp_list", {
    side: "remote",
    path: "/root/uploads/projects",
  }) as Directory;
  assert.equal(directory.entries[0].name, "readme.md");
  call("sftp_transfer", { request: { ...request, id: "conflict" } });
  await finish();
  assert.ok(
    events.some((e) => e.type === "transfer" && e.data.status === "conflict"),
  );
  call("sftp_transfer", {
    request: { ...request, id: "cancel", conflict: "keepBoth" },
  });
  call("sftp_cancel", { id: "cancel" });
  await finish();
  const uploads = call("sftp_list", {
    side: "remote",
    path: "/root/uploads",
  }) as Directory;
  assert.equal(uploads.entries.length, 1);
  backend.closeAll();
  assert.throws(() => call("sftp_list", { side: "remote", path: "/root" }), {
    code: "sftp.NotConnected",
  });
});
