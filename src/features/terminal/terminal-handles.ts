import type { Terminal } from "@xterm/xterm";
import { desktop } from "@/lib/platform";

// Live terminals by tab id, so global shortcuts can reach the focused one.
export const terminalHandles = new Map<string, Terminal>();
// Where a pane's typed input goes, by tab id: what a broadcasting pane calls to feed the others.
export const sessionInputs = new Map<string, (data: string) => void>();
// Panes that receive what is typed in each pane (see broadcastPeers), kept in step with the tab list.
export const broadcastTargets = new Map<string, string[]>();
// The browser preview has no backend: tests drive the demo terminals through this.
if (!desktop)
  (window as unknown as { __terminals: unknown }).__terminals = terminalHandles;
