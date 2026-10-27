import { defineConfig } from "@playwright/test";

// Worktrees can run side by side: set E2E_PORT so each one serves its own code.
const port = process.env.E2E_PORT ?? "5174";

// Visual regression on the browser preview (synthetic data, no SSH).
export default defineConfig({
  testDir: ".",
  testMatch: "visual*.spec.ts",
  snapshotPathTemplate: "{testDir}/visual-snapshots/{arg}{ext}",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  },
  projects: [
    { name: "chromium" },
    // The macOS app renders with WebKit: only the engine-specific specs run there.
    {
      name: "webkit",
      use: { browserName: "webkit" },
      testMatch: ["visual-overlay.spec.ts", "visual-first-run.spec.ts"],
    },
  ],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.0002,
    },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    // A leftover server could serve another checkout's code and give a false result.
    reuseExistingServer: false,
  },
});
