import type { Terminal } from "@xterm/xterm";

// Test hooks the specs install in the page (and the app exposes in the browser preview).
declare global {
  interface Window {
    __copied: string[];
    __seen: (string | null)[][];
    __terminals: Map<string, Terminal>;
  }
}
