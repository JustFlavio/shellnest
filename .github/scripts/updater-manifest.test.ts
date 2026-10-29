import assert from "node:assert/strict";
import { test } from "node:test";
import { missingPlatforms } from "./updater-manifest.ts";

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
