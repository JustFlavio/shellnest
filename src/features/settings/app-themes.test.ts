import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_THEMES,
  appTheme,
  mixHex,
  resolveScheme,
  themeVars,
} from "./app-themes.ts";

test("every theme sets every color as #rrggbb in both schemes", () => {
  const ids = new Set(APP_THEMES.map((t) => t.id));
  assert.equal(ids.size, APP_THEMES.length);
  for (const theme of APP_THEMES)
    for (const palette of [theme.light, theme.dark])
      for (const [name, value] of Object.entries(themeVars(palette)))
        assert.match(value, /^#[0-9a-f]{6}$/, `${theme.id} ${name}`);
});

test("unknown themes fall back to the first one", () => {
  assert.equal(appTheme("ghost").id, "shellnest");
});

test("system follows the operating system", () => {
  assert.equal(resolveScheme("system", true), "dark");
  assert.equal(resolveScheme("system", false), "light");
  assert.equal(resolveScheme("light", true), "light");
  assert.equal(resolveScheme("dark", false), "dark");
});

test("mixHex blends channels and ignores alpha", () => {
  assert.equal(mixHex("#ffffff", "#000000", 0.5), "#808080");
  assert.equal(mixHex("#ff000080", "#0000ff", 1), "#ff0000");
  assert.equal(mixHex("#f5a524", "#17140f", 0), "#17140f");
});
