import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT ?? "5187";
export default defineConfig({
  testDir: ".",
  testMatch: "sftp.spec.ts",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
