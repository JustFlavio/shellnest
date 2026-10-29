import assert from "node:assert/strict";
import { test } from "node:test";
import { isNewer, missingPlatforms } from "./updater-manifest.ts";

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
