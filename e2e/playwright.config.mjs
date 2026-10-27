import { defineConfig } from "@playwright/test";

// Worktrees can run side by side: set E2E_PORT so each one serves its own code.
const port = process.env.E2E_PORT ?? "5173";

// Visual regression on the browser preview (synthetic data, no SSH).
export default defineConfig({
  testDir: ".",
  testMatch: "visual*.spec.mjs",
  snapshotPathTemplate: "{testDir}/visual-snapshots/{arg}{ext}",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.0002 },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
