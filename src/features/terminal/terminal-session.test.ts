import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import type { Channel } from "@tauri-apps/api/core";
import type { Output, TerminalTab } from "../../lib/types.ts";
import type { Xterm } from "./xterm.ts";

Object.defineProperties(globalThis, {
  window: { value: { crypto: globalThis.crypto }, configurable: true },
  isTauri: { value: true, configurable: true },
});
const { startSession } = await import("./terminal-session.ts");
const { sessionInputs, broadcastTargets } =
  await import("./terminal-handles.ts");

const channels = new Map<string, Channel<Output>>();
const inputs: { id: string; data: string }[] = [];
const stops: (() => void)[] = [];

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  clearMocks();
  channels.clear();
  sessionInputs.clear();
  broadcastTargets.clear();
  inputs.length = 0;
});

function pane(id: string, inputResult?: () => Promise<void>) {
  mockIPC((command, payload) => {
    const args = payload as {
      sessionId: string;
      data: string;
      output: Channel<Output>;
    };
    if (command === "connect_local") channels.set(args.sessionId, args.output);
    if (command === "terminal_input") {
      inputs.push({ id: args.sessionId, data: args.data });
      return inputResult?.();
    }
  });
  let type = (_data: string) => {};
  let buffer = "previous output";
  let blurred = false;
  const options = { disableStdin: false };
  const writes: (() => void)[] = [];
  const term = {
    options,
    cols: 80,
    rows: 24,
    write: (data: string | Uint8Array, callback?: () => void) => {
      writes.push(() => {
        buffer +=
          typeof data === "string" ? data : new TextDecoder().decode(data);
        callback?.();
      });
    },
    reset: () => {
      buffer = "";
    },
    blur: () => {
      blurred = true;
    },
    focus: () => {},
    hasSelection: () => false,
    onData: (listener: (data: string) => void) => {
      type = listener;
      return { dispose: () => {} };
    },
    onResize: () => ({ dispose: () => {} }),
  };
  const statuses: string[] = [];
  const errors: string[] = [];
  const tab: TerminalTab = {
    id,
    kind: "local",
    vaultId: "test",
    title: id,
    username: "",
    identityName: "",
  };
  stops.push(
    startSession(
      tab,
      { term, refit: () => {} } as unknown as Xterm,
      {
        status: () => {},
        log: () => {},
        detail: () => {},
        opened: () => {},
        failure: () => {},
        password: () => {},
      },
      {
        current: {
          onStatus: (_id, status) => {
            statuses.push(status);
          },
          onError: (error) => {
            errors.push(error);
          },
          onTitle: () => {},
          onMetadata: () => {},
        },
      },
    ),
  );
  return {
    type: (data: string) => type(data),
    emit: (event: Output) => channels.get(id)!.onmessage(event),
    flush: () => writes.splice(0).forEach((write) => write()),
    options,
    statuses,
    errors,
    get buffer() {
      return buffer;
    },
    get blurred() {
      return blurred;
    },
  };
}

test("closing clears queued output, disables input and reports closed once", async () => {
  const p = pane("a");
  p.type("early");
  p.emit({ type: "status", data: "connected" });
  await Promise.resolve();
  assert.deepEqual(inputs, [{ id: "a", data: "early" }]);
  const staleSend = sessionInputs.get("a")!;
  p.emit({ type: "data", data: [65] });
  p.emit({ type: "closed" });
  p.emit({ type: "closed" });
  p.emit({ type: "data", data: [66] });
  p.type("ignored".repeat(40000));
  staleSend("stale broadcast");
  p.flush();
  await Promise.resolve();
  assert.equal(p.buffer, "");
  assert.equal(p.options.disableStdin, true);
  assert.equal(p.blurred, true);
  assert.equal(sessionInputs.has("a"), false);
  assert.deepEqual(p.statuses, ["connected", "closed"]);
  assert.deepEqual(p.errors, []);
  assert.equal(inputs.length, 1);
});

test("broadcast skips a closed peer even before targets are refreshed", async () => {
  const a = pane("a"),
    b = pane("b"),
    c = pane("c");
  for (const p of [a, b, c]) p.emit({ type: "status", data: "connected" });
  broadcastTargets.set("a", ["b", "c"]);
  broadcastTargets.set("b", ["a", "c"]);
  sessionInputs.get("b")!("queued before closing");
  b.emit({ type: "closed" });
  b.type("must not broadcast");
  a.type("ls\r");
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(inputs, [
    { id: "a", data: "ls\r" },
    { id: "c", data: "ls\r" },
  ]);
});

test("failure disables input and cannot be reopened by late events", () => {
  const p = pane("failed");
  p.emit({ type: "status", data: "connected" });
  p.emit({ type: "error", data: { code: "terminal.SessionClosed" } });
  p.emit({ type: "status", data: "connected" });
  p.emit({ type: "closed" });
  p.type("ignored");
  p.flush();
  assert.deepEqual(p.statuses, ["connected", "failed"]);
  assert.equal(p.options.disableStdin, true);
  assert.equal(p.buffer, "");
  assert.equal(sessionInputs.has("failed"), false);
});

test("an in-flight input rejected after closing does not report a new error", async () => {
  let rejectInput = (_error: Error) => {};
  const result = new Promise<void>((_resolve, reject) => {
    rejectInput = reject;
  });
  const p = pane("a", () => result);
  p.emit({ type: "status", data: "connected" });
  p.type("ls\r");
  await Promise.resolve();
  assert.equal(inputs.length, 1);
  p.emit({ type: "closed" });
  rejectInput(new Error("Session closed"));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(p.errors, []);
});
