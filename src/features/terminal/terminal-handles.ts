import type { Terminal } from "@xterm/xterm";
import { desktop } from "@/lib/platform";

// Live terminals by tab id, so global shortcuts can reach the focused one.
export const terminalHandles = new Map<string, Terminal>();
// The browser preview has no backend: tests drive the demo terminals through this.
if (!desktop)
  (window as unknown as { __terminals: unknown }).__terminals = terminalHandles;
