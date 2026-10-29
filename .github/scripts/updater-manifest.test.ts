import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isNewer,
  latestUrls,
  missingPlatforms,
  retarget,
} from "./updater-manifest.ts";

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

test("only a strictly higher version is newer", () => {
  assert.equal(isNewer("0.2.0", "0.1.9"), true);
  assert.equal(isNewer("0.10.0", "0.9.0"), true);
  assert.equal(isNewer("0.1.0", "0.1.0"), false);
  assert.equal(isNewer("0.1.0", "0.1.1"), false);
  assert.equal(isNewer("1.0.0-beta.1", "0.9.0"), true);
});

test("a latest/download URL is rewritten to the tag, others are left alone", () => {
  const manifest = {
    version: "0.1.1",
    platforms: {
      "darwin-aarch64": {
        signature: "sig",
        url: "https://github.com/o/r/releases/latest/download/a.app.tar.gz",
      },
      "linux-x86_64": {
        signature: "sig",
        url: "https://github.com/o/r/releases/latest/download/c.AppImage",
      },
      "windows-x86_64": {
        signature: "sig",
        url: "https://github.com/o/r/releases/download/v0.1.1/b.exe",
      },
    },
  };
  assert.deepEqual(latestUrls(manifest), ["darwin-aarch64", "linux-x86_64"]);
  const fixed = retarget(manifest, "v0.1.1");
  assert.deepEqual(latestUrls(fixed), []);
  assert.equal(
    fixed.platforms?.["darwin-aarch64"]?.url,
    "https://github.com/o/r/releases/download/v0.1.1/a.app.tar.gz",
  );
  assert.equal(
    fixed.platforms?.["linux-x86_64"]?.url,
    "https://github.com/o/r/releases/download/v0.1.1/c.AppImage",
  );
  assert.equal(
    fixed.platforms?.["windows-x86_64"]?.url,
    manifest.platforms["windows-x86_64"].url,
  );
  assert.equal(fixed.version, "0.1.1");
});
