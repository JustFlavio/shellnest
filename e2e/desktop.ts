import { spawn } from "node:child_process";
import type { StdioOptions } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSyncServer } from "../sync/src/app.ts";
import { createInvite } from "../sync/src/invite.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = join(root, "artifacts", "desktop-e2e");
await mkdir(artifacts, { recursive: true });
const dataDir = await mkdtemp(join(tmpdir(), "shellnest-e2e-"));
// A real sync server on loopback, with its data beside the test vault.
const syncDir = join(dataDir, "sync-server");
const sync = await createSyncServer({ directory: syncDir });
sync.listen(0, "127.0.0.1");
await once(sync, "listening");
const env = {
  ...process.env,
  SHELLNEST_E2E_DATA_DIR: dataDir,
  WEBVIEW2_USER_DATA_FOLDER: join(dataDir, "webview"),
  SHELLNEST_E2E_SYNC_URL: `http://127.0.0.1:${(sync.address() as AddressInfo).port}`,
  SHELLNEST_E2E_INVITE: await createInvite(syncDir, true),
};

function run(script: string, args: string[], stdio: StdioOptions = "inherit") {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root,
      env,
      stdio,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Desktop test command failed (${signal ?? code})`));
    });
  });
}

try {
  console.log("Building desktop test app (artifacts/desktop-e2e/build.log)...");
  const buildLog = openSync(join(artifacts, "build.log"), "w");
  try {
    await run(
      "node_modules/@tauri-apps/cli/tauri.js",
      [
        "build",
        "--debug",
        "--no-bundle",
        "--features",
        "desktop-e2e",
        "--config",
        "src-tauri/tauri.e2e.conf.json",
      ],
      ["ignore", buildLog, buildLog],
    );
  } finally {
    closeSync(buildLog);
  }
  await run("node_modules/@wdio/cli/bin/wdio.js", ["run", "e2e/wdio.conf.ts"]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  sync.closeAllConnections();
  sync.close();
  await rm(dataDir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}
