import assert from "node:assert/strict";
import { test } from "node:test";
import { invalidDownloads, missingPlatforms } from "./updater-manifest.ts";

test("a manifest with all four platforms is complete, with or without a bundle suffix", () => {
  assert.deepEqual(
    missingPlatforms({
      platforms: {
        "darwin-aarch64": {},
        "darwin-x86_64-app": {},
        "windows-x86_64-nsis": {},
        "linux-x86_64-appimage": {},
      },
    }),
    [],
  );
});

test("missing platforms are listed", () => {
  assert.deepEqual(missingPlatforms({ platforms: { "darwin-aarch64": {} } }), [
    "darwin-x86_64",
    "windows-x86_64",
    "linux-x86_64",
  ]);
  assert.equal(missingPlatforms({}).length, 4);
});

test("updater downloads support old browser URLs and tauri-action 1 API URLs", () => {
  const asset = {
    url: "https://api.github.com/repos/JustFlavio/shellnest/releases/assets/123",
    browser_download_url:
      "https://github.com/JustFlavio/shellnest/releases/download/v0.1.4/Shellnest_0.1.4_aarch64.app.tar.gz",
  };
  for (const url of [
    asset.url,
    asset.browser_download_url,
    asset.browser_download_url.replace("download/v0.1.4", "latest/download"),
  ]) {
    assert.deepEqual(
      invalidDownloads(
        {
          platforms: {
            "darwin-aarch64": { url, signature: "synthetic-signature" },
          },
        },
        [asset],
      ),
      [],
    );
  }
  assert.deepEqual(
    invalidDownloads(
      {
        platforms: {
          "darwin-aarch64": { url: asset.url, signature: " " },
          "windows-x86_64": {
            url: "https://github.com/JustFlavio/shellnest/releases/download/v0.1.3/old.exe",
            signature: "synthetic-signature",
          },
          "linux-x86_64": undefined,
        },
      },
      [asset],
    ),
    ["darwin-aarch64", "windows-x86_64", "linux-x86_64"],
  );
});
