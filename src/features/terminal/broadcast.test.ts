import test from "node:test";
import assert from "node:assert/strict";
import { broadcastPeers, inputForPeer } from "./broadcast.ts";

const pane = (id: string, status = "connected") => ({ id, status });

test("peers are the connected panes of the same workspace only", () => {
  const layout = {
    dir: "row" as const,
    ratio: 0.5,
    a: { id: "a" },
    b: {
      dir: "col" as const,
      ratio: 0.5,
      a: { id: "b" },
      b: { id: "c" },
    },
  };
  const tabs = [
    { ...pane("a"), broadcast: true, layout },
    pane("b"),
    pane("c", "connecting"),
    pane("x"),
  ];
  const peers = broadcastPeers(tabs);
  assert.deepEqual(peers.get("a"), ["b"]);
  assert.deepEqual(peers.get("b"), ["a"]);
  assert.deepEqual(peers.get("c"), ["a", "b"]);
  assert.equal(peers.has("x"), false);
});

test("off or unsplit workspaces broadcast nothing", () => {
  assert.equal(
    broadcastPeers([{ ...pane("a"), broadcast: true }, pane("b")]).size,
    0,
  );
  assert.equal(broadcastPeers([pane("a"), pane("b")]).size, 0);
});

test("a paste is unwrapped for a peer without bracketed paste", () => {
  const wrapped = "\x1b[200~ls\rpwd\x1b[201~";
  assert.equal(inputForPeer(wrapped, true), wrapped);
  assert.equal(inputForPeer(wrapped, false), "ls\rpwd");
  assert.equal(inputForPeer("ls\r", false), "ls\r");
  assert.equal(inputForPeer("\x1b[200~partial", false), "\x1b[200~partial");
});
