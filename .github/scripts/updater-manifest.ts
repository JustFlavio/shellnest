// Checks the latest.json that tauri-action builds, for release-assets.yml.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type Manifest = {
  version?: unknown;
  platforms?: Record<string, { url?: string } | undefined>;
};

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
  } else {
    console.error("usage: updater-manifest.ts check <file> <version>");
    process.exit(2);
  }
}
