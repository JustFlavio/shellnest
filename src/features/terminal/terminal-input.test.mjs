import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizePaste,
  needsPasteConfirm,
  RESET_MODES,
  terminalKeyAction,
} from "./terminal-input.mjs";

test("sanitizePaste strips ESC and controls but keeps newlines and tabs", () => {
  assert.equal(
    sanitizePaste("ls\x1b[201~; rm -rf ~\x1b[200~\x07\x00\x7f\u009b"),
    "ls[201~; rm -rf ~[200~",
  );
  assert.equal(sanitizePaste("a\tb\r\nc\rd\ne"), "a\tb\nc\nd\ne");
  assert.equal(sanitizePaste("àè€ 日本 😀"), "àè€ 日本 😀");
});

test("needsPasteConfirm above 20 lines", () => {
  assert.equal(needsPasteConfirm("x\n".repeat(19) + "x"), false);
  assert.equal(needsPasteConfirm("x\n".repeat(20) + "x"), true);
});

test("RESET_MODES turns off the sticky modes", () => {
  for (const m of ["2004l", "1000l", "1002l", "1003l", "1006l", "1049l", "25h"])
    assert.ok(RESET_MODES.includes(`\x1b[?${m}`), m);
});

const ev = (key, mods = {}) => ({
  type: "keydown",
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

test("mac keys", () => {
  const k = (e, sel = false) => terminalKeyAction(e, true, sel);
  assert.equal(k(ev("c", { metaKey: true }), true), "copy");
  assert.equal(k(ev("c", { metaKey: true })), "swallow");
  assert.equal(k(ev("c", { ctrlKey: true }), true), undefined);
  assert.equal(k(ev("f", { metaKey: true })), "search");
  assert.equal(k(ev("Backspace", { metaKey: true })), "line-kill");
  assert.equal(k(ev("ArrowLeft", { altKey: true })), "word-back");
  assert.equal(k(ev("ArrowRight", { altKey: true })), "word-forward");
  assert.equal(k(ev("ArrowLeft", { altKey: true, metaKey: true })), undefined);
  // Option+L produces "@" on Italian layouts: untouched
  assert.equal(k(ev("@", { altKey: true })), undefined);
  assert.equal(
    terminalKeyAction(
      { ...ev("c", { metaKey: true }), type: "keyup" },
      true,
      true,
    ),
    undefined,
  );
});

test("windows keys", () => {
  const k = (e, sel = false) => terminalKeyAction(e, false, sel);
  assert.equal(k(ev("c", { ctrlKey: true }), true), "copy");
  assert.equal(k(ev("c", { ctrlKey: true })), undefined);
  assert.equal(k(ev("C", { ctrlKey: true, shiftKey: true })), "copy");
  assert.equal(k(ev("V", { ctrlKey: true, shiftKey: true })), "paste");
  assert.equal(k(ev("f", { ctrlKey: true })), "search");
  assert.equal(k(ev("F", { ctrlKey: true, shiftKey: true })), undefined);
  assert.equal(k(ev("ArrowLeft", { altKey: true })), undefined);
});
