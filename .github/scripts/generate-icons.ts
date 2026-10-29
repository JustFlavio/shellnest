import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../../", import.meta.url));
const generated = join(root, "artifacts", "icons");
const output = join(root, "src-tauri", "icons");
const source = readFileSync(join(root, "src-tauri", "app-icon.png"));
const sizes = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 128, 256];
mkdirSync(generated, { recursive: true });
// The 1254px source's opaque artwork spans x=116..1137, y=132..1122.
// Windows/Linux use 96% of the canvas. macOS retains an inset for its dock grid.
function generate(platform: string, viewport: string, args: string[]) {
  const svg = join(generated, `${platform}.svg`);
  writeFileSync(
    svg,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${viewport}"><image width="1254" height="1254" href="data:image/png;base64,${source.toString("base64")}"/></svg>`,
  );
  const result = spawnSync(
    process.execPath,
    [join(root, "node_modules/@tauri-apps/cli/tauri.js"), "icon", svg, ...args],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Icon generation failed");
}
const desktop = join(generated, "desktop");
generate("desktop", "94.5 94.5 1065 1065", ["--output", desktop]);
for (const file of readdirSync(desktop)) {
  if (/\.(png|ico)$/.test(file))
    copyFileSync(join(desktop, file), join(output, file));
}
const mac = join(generated, "mac");
generate("mac", "7 7 1240 1240", ["--output", mac]);
copyFileSync(join(mac, "icon.icns"), join(output, "icon.icns"));
const windows = join(generated, "windows");
generate("windows", "94.5 94.5 1065 1065", [
  "--output",
  windows,
  ...[...sizes, 512].flatMap((size) => ["--png", String(size)]),
]);
// ICO's zero dimension byte denotes 256. Every frame contains a PNG with alpha.
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
const frames = sizes.map((size, index) => {
  const png = readFileSync(join(windows, `${size}x${size}.png`));
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
  const entry = 6 + index * 16;
  header[entry] = header[entry + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
  return png;
});
writeFileSync(join(output, "icon.ico"), Buffer.concat([header, ...frames]));
for (const size of [48, 512])
  copyFileSync(
    join(windows, `${size}x${size}.png`),
    join(output, `${size}x${size}.png`),
  );
