import { spawn } from "node:child_process";
import type { StdioOptions } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = join(root, "artifacts", "desktop-e2e");
await mkdir(artifacts, { recursive: true });
const dataDir = await mkdtemp(join(tmpdir(), "shellnest-e2e-"));
const env = {
  ...process.env,
  SHELLNEST_E2E_DATA_DIR: dataDir,
  WEBVIEW2_USER_DATA_FOLDER: join(dataDir, "webview"),
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
  await rm(dataDir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}
