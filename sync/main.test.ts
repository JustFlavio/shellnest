import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./server.ts", import.meta.url));

const start = (
  env: Record<string, string | undefined>,
  args: string[] = [],
) => {
  const child = spawn(process.execPath, [entry, ...args], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const exited = new Promise<number | null>((resolve) =>
    child.once("exit", resolve),
  );
  return { child, output: () => output, exited };
};

// A server that fails to start must fail the test, not leave it polling forever.
const listening = async (server: ReturnType<typeof start>) => {
  const deadline = Date.now() + 10_000;
  while (!/listening on/.test(server.output())) {
    if (Date.now() > deadline)
      throw new Error(`no "listening on" line:\n${server.output()}`);
    await new Promise((r) => setTimeout(r, 20));
  }
};

test("prints a single-use invite and refuses bad arguments and ports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shellnest-main-"));
  try {
    const invite = start({ SYNC_DATA_DIR: directory }, ["invite", "--admin"]);
    assert.equal(await invite.exited, 0);
    assert.match(
      invite.output(),
      /Admin invite \(single use, valid 7 days\):\n[A-Za-z0-9_-]{43}/,
    );
    const wrong = start({ SYNC_DATA_DIR: directory }, ["serve"]);
    assert.equal(await wrong.exited, 1);
    assert.match(wrong.output(), /Usage:/);
    const port = start({ SYNC_PORT: "99999" });
    assert.equal(await port.exited, 1);
    assert.match(port.output(), /cannot start: SYNC_PORT is not a valid port/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// Windows has no SIGTERM: kill() ends the process at once, so the graceful path cannot be tested there.
test(
  "starts on loopback, serves /health, stops on SIGTERM",
  { skip: process.platform === "win32" },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "shellnest-main-"));
    const server = start({ SYNC_PORT: "0", SYNC_DATA_DIR: directory });
    const { child, output } = server;
    try {
      await listening(server);
      const [, address, port] = /listening on (.+):(\d+),/.exec(output())!;
      assert.equal(address, "127.0.0.1");
      const res = await fetch(`http://${address}:${port}/health`);
      assert.equal(res.status, 200);
      child.kill("SIGTERM");
      const [code] = await once(child, "exit");
      assert.equal(code, 0);
      assert.match(output(), /SIGTERM received/);
    } finally {
      child.kill("SIGKILL");
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("reports a busy port instead of a stack trace", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shellnest-main-"));
  const first = start({ SYNC_PORT: "0", SYNC_DATA_DIR: directory });
  try {
    await listening(first);
    const port = /listening on .+:(\d+),/.exec(first.output())![1];
    const second = start({ SYNC_PORT: port, SYNC_DATA_DIR: directory });
    const [code] = await once(second.child, "exit");
    assert.equal(code, 1);
    assert.match(second.output(), /cannot listen on 127.0.0.1:\d+/);
  } finally {
    first.child.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});
