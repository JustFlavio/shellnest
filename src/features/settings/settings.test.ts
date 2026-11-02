import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  clampFontSize,
  clampLineHeight,
  fontStack,
  parseSettings,
  terminalColors,
} from "./settings.ts";

test("missing or corrupt storage gives the defaults", () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings("nope"), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings("[1]"), DEFAULT_SETTINGS);
});

test("valid fields are kept, bad ones fall back individually", () => {
  const s = parseSettings(
    JSON.stringify({
      fontSize: 99,
      terminalTheme: "nord",
      bell: "yes",
      scrollback: 10,
      fontFamily: "Fira Code",
    }),
  );
  assert.equal(s.fontSize, 32);
  assert.equal(s.terminalTheme, "nord");
  assert.equal(s.bell, false);
  assert.equal(s.scrollback, 500);
  assert.equal(s.fontFamily, "Fira Code");
  assert.equal(
    parseSettings('{"terminalTheme":"ghost"}').terminalTheme,
    "shellnest",
  );
  assert.equal(parseSettings('{"fontFamily":"a\\nb"}').fontFamily, "");
});

test("font stack and size helpers", () => {
  assert.match(fontStack(""), /Cascadia Code/);
  assert.equal(fontStack("Fira Code"), '"Fira Code", monospace');
  assert.equal(fontStack('"A", serif'), '"A", serif');
  assert.equal(clampFontSize(3), 8);
});

test("update checks are on by default and only a boolean turns them off", () => {
  assert.equal(parseSettings(null).checkUpdates, true);
  assert.equal(parseSettings('{"checkUpdates":false}').checkUpdates, false);
  assert.equal(parseSettings('{"checkUpdates":"no"}').checkUpdates, true);
});

test("line height defaults to 1.15 and is clamped to its range", () => {
  assert.equal(parseSettings(null).lineHeight, 1.15);
  assert.equal(parseSettings('{"lineHeight":1.3}').lineHeight, 1.3);
  assert.equal(parseSettings('{"lineHeight":5}').lineHeight, 1.6);
  assert.equal(parseSettings('{"lineHeight":0.2}').lineHeight, 1);
  assert.equal(parseSettings('{"lineHeight":"1.3"}').lineHeight, 1.15);
  assert.equal(clampLineHeight(1.234), 1.23);
});

test("the language is kept when it is supported, otherwise it follows the system", () => {
  assert.equal(parseSettings('{"language":"it"}').language, "it");
  assert.equal(parseSettings('{"language":"en"}').language, "en");
  assert.equal(parseSettings('{"language":"system"}').language, "system");
  assert.equal(parseSettings('{"language":"xx"}').language, "system");
  assert.equal(parseSettings("{}").language, "system");
});

test("color scheme follows the system and the app theme falls back to Shellnest", () => {
  assert.equal(parseSettings(null).colorScheme, "system");
  assert.equal(parseSettings('{"colorScheme":"light"}').colorScheme, "light");
  assert.equal(parseSettings('{"colorScheme":"sepia"}').colorScheme, "system");
  assert.equal(parseSettings('{"appTheme":"fjord"}').appTheme, "fjord");
  assert.equal(parseSettings('{"appTheme":"ghost"}').appTheme, "shellnest");
});

test("the match-app terminal theme takes the interface colors", () => {
  const dark = terminalColors(
    { terminalTheme: "shellnest", appTheme: "fjord" },
    "dark",
  );
  assert.equal(dark.background, "#10151c");
  assert.equal(dark.cursor, "#5aa9ff");
  assert.equal(dark.red, undefined);
  const light = terminalColors(
    { terminalTheme: "shellnest", appTheme: "fjord" },
    "light",
  );
  assert.equal(light.background, "#f6f8fb");
  assert.ok(light.brightWhite);
  assert.equal(
    terminalColors({ terminalTheme: "nord", appTheme: "fjord" }, "light")
      .background,
    "#2e3440",
  );
});
