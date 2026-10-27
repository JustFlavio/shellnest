import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

if (!process.env.SHELLNEST_E2E_DATA_DIR) {
  throw new Error("Use npm run test:desktop to create an isolated test vault.");
}

const binary = fileURLToPath(
  new URL(
    `../src-tauri/target/debug/shellnest${process.platform === "win32" ? ".exe" : ""}`,
    import.meta.url,
  ),
);
const artifacts = fileURLToPath(
  new URL("../artifacts/desktop-e2e/", import.meta.url),
);

export const config = {
  specs: ["./desktop.spec.mjs"],
  maxInstances: 1,
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: binary,
        driverProvider: "embedded",
        captureBackendLogs: false,
        captureFrontendLogs: false,
      },
    ],
  ],
  capabilities: [{ browserName: "tauri" }],
  framework: "mocha",
  reporters: ["spec"],
  logLevel: "info",
  outputDir: artifacts,
  waitforTimeout: 15000,
  connectionRetryCount: 0,
  connectionRetryTimeout: 20000,
  mochaOpts: { timeout: 90000 },
  async afterTest(_test, _context, { passed }) {
    if (!passed) {
      await mkdir(artifacts, { recursive: true });
      await browser.saveScreenshot(`${artifacts}/failure.png`);
    }
  },
};
