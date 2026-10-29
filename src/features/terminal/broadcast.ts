import { leafIds } from "./workbench-state.ts";
import type { LayoutNode } from "./workbench-state.ts";

export type BroadcastTab = {
  id: string;
  status?: string;
  layout?: LayoutNode;
  broadcast?: boolean;
};

// For each pane of a workspace that broadcasts: the other panes of the same workspace whose session is connected.
export function broadcastPeers(tabs: BroadcastTab[]): Map<string, string[]> {
  const connected = new Set(
    tabs.filter((t) => t.status === "connected").map((t) => t.id),
  );
  const peers = new Map<string, string[]>();
  for (const leader of tabs) {
    if (!leader.broadcast || !leader.layout) continue;
    const ids = leafIds(leader.layout);
    for (const id of ids)
      peers.set(
        id,
        ids.filter((other) => other !== id && connected.has(other)),
      );
  }
  return peers;
}

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

// A paste arrives wrapped for the source pane's mode (sanitizePaste strips ESC, so typing never looks like this):
// a peer that has not enabled bracketed paste gets the bare text.
export function inputForPeer(data: string, peerBracketed: boolean): string {
  if (peerBracketed || !data.startsWith(PASTE_START)) return data;
  return data.endsWith(PASTE_END)
    ? data.slice(PASTE_START.length, -PASTE_END.length)
    : data;
}
