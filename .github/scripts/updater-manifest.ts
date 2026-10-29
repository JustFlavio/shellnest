// Checks and compares the latest.json that tauri-action builds, for updater-manifest.yml.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type Manifest = { version?: unknown; platforms?: Record<string, unknown> };

export const REQUIRED_PLATFORMS = [
  "darwin-aarch64",
  "darwin-x86_64",
  "windows-x86_64",
  "linux-x86_64",
];

/** The platforms missing from the manifest; "darwin-aarch64-app" counts as "darwin-aarch64". */
export function missingPlatforms(manifest: Manifest): string[] {
  const got = Object.keys(manifest.platforms ?? {});
  return REQUIRED_PLATFORMS.filter(
    (p) => !got.some((g) => g === p || g.startsWith(`${p}-`)),
  );
}

const core = (version: string): number[] =>
  version.split(/[-+]/)[0].split(".").map(Number);

/** True when `candidate` is a strictly higher x.y.z than `current` (pre-release tags are ignored). */
export function isNewer(candidate: string, current: string): boolean {
  const a = core(candidate);
  const b = core(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

const read = (path: string): Manifest => JSON.parse(readFileSync(path, "utf8"));

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, file, other] = process.argv.slice(2);
  const manifest = read(file);
  if (command === "check") {
    // `other` is the release version, without the leading v.
    const missing = missingPlatforms(manifest);
    if (missing.length || manifest.version !== other) {
      console.error(
        `latest.json is for ${String(manifest.version)} (want ${other}), missing: ${missing.join(", ") || "none"}`,
      );
      process.exit(1);
    }
  } else if (command === "newer") {
    // Exit 0 when `file` is newer than `other`.
    process.exit(
      isNewer(String(manifest.version), String(read(other).version)) ? 0 : 3,
    );
  } else {
    console.error(
      "usage: updater-manifest.ts check|newer <file> <version|file>",
    );
    process.exit(2);
  }
}
