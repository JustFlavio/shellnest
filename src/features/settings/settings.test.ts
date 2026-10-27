import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  clampFontSize,
  fontStack,
  parseSettings,
  terminalTheme,
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
  assert.equal(terminalTheme("zzz").id, "shellnest");
});

test("update checks are on by default and only a boolean turns them off", () => {
  assert.equal(parseSettings(null).checkUpdates, true);
  assert.equal(parseSettings('{"checkUpdates":false}').checkUpdates, false);
  assert.equal(parseSettings('{"checkUpdates":"no"}').checkUpdates, true);
});
