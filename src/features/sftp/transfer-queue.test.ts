import { test } from "node:test";
import assert from "node:assert/strict";
import { TransferQueue } from "./transfer-queue.ts";
import type { FileEntry, Transfer, TransferRequest } from "./types.ts";
const file: FileEntry = {
  name: "one",
  path: "/one",
  kind: "file",
  size: 3,
  modified: null,
  hidden: false,
};
test("queue serializes starts and pauses at a conflict until the user resolves it", () => {
  const started: TransferRequest[] = [];
  let items: Transfer[] = [];
  const queue = new TransferQueue(
    async (request) => {
      started.push(request);
    },
    async () => {},
    (value) => {
      items = value;
    },
    () => ({ code: "sftp.Io" }),
  );
  queue.enqueue(
    "local",
    [file, { ...file, name: "two", path: "/two" }],
    "/target",
  );
  assert.equal(started.length, 0);
  queue.connected();
  assert.equal(started.length, 1);
  const first = started[0].id;
  queue.progress({
    id: first,
    status: "conflict",
    bytes: 0,
    current: file.path,
    error: { code: "sftp.Exists" },
  });
  assert.equal(started.length, 1);
  queue.resolve(first, "replace");
  assert.equal(started.length, 2);
  assert.equal(started[1].conflict, "replace");
  queue.progress({
    id: first,
    status: "completed",
    bytes: 3,
    current: file.path,
    error: null,
  });
  assert.equal(started.length, 3);
  assert.equal(items[0].status, "completed");
  queue.disconnected();
  queue.progress({
    id: started[2].id,
    status: "completed",
    bytes: 3,
    current: "/two",
    error: null,
  });
  assert.equal(
    items[1].status,
    "cancelled",
    "late messages cannot revive a disconnected job",
  );
});
test("cancelling a conflict resumes the next request; clearing cannot remove active jobs", async () => {
  let items: Transfer[] = [];
  const queue = new TransferQueue(
    async () => {},
    async () => {},
    (value) => {
      items = value;
    },
    () => null,
  );
  queue.connected();
  queue.enqueue("remote", [file, file], "/target");
  const first = items[0].id;
  queue.progress({
    id: first,
    status: "conflict",
    bytes: 0,
    current: file.path,
    error: null,
  });
  await queue.cancel(first);
  assert.equal(items[1].status, "running");
  queue.clear();
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "running");
});
