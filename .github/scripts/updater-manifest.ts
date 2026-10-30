// Checks the latest.json that tauri-action builds, for release-assets.yml.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type Manifest = {
  version?: unknown;
  platforms?: Record<string, { url?: string; signature?: string } | undefined>;
};

type ReleaseAsset = { url: string; browser_download_url: string };

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

/** Accept both tauri-action 0.x browser URLs and 1.x API asset URLs. */
export function invalidDownloads(
  manifest: Manifest,
  assets: ReleaseAsset[],
): string[] {
  const urls = new Set(
    assets.flatMap((asset) => [
      asset.url,
      asset.browser_download_url,
      // Published 0.1.3 manifests used latest aliases with the original asset names.
      asset.browser_download_url.replace(
        /\/releases\/download\/[^/]+\//,
        "/releases/latest/download/",
      ),
    ]),
  );
  return Object.entries(manifest.platforms ?? {})
    .filter(
      ([, platform]) =>
        !platform?.signature?.trim() ||
        !platform.url ||
        !urls.has(platform.url),
    )
    .map(([platform]) => platform);
}

const read = (path: string): Manifest => JSON.parse(readFileSync(path, "utf8"));

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, file, other, assetsFile] = process.argv.slice(2);
  const manifest = read(file);
  if (command === "check") {
    // `other` is the release version, without the leading v.
    const missing = missingPlatforms(manifest);
    const invalid = invalidDownloads(
      manifest,
      JSON.parse(readFileSync(assetsFile, "utf8")).flat(),
    );
    if (missing.length || invalid.length || manifest.version !== other) {
      console.error(
        `latest.json is for ${String(manifest.version)} (want ${other}), missing: ${missing.join(", ") || "none"}, invalid downloads: ${invalid.join(", ") || "none"}`,
      );
      process.exit(1);
    }
  } else {
    console.error(
      "usage: updater-manifest.ts check <file> <version> <release-assets.json>",
    );
    process.exit(2);
  }
}
