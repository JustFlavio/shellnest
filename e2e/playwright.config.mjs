import { defineConfig } from "@playwright/test";

// Visual regression on the browser preview (synthetic data, no SSH).
export default defineConfig({
  testDir: ".",
  testMatch: "visual*.spec.mjs",
  snapshotPathTemplate: "{testDir}/visual-snapshots/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
