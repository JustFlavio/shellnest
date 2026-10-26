import test from "node:test";
import assert from "node:assert/strict";
import { SHORTCUTS, actionFor, format } from "./shortcuts.mjs";

const ev = (key, m = {}, code = "") => ({
  key,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...m,
});

test("macOS defaults", () => {
  assert.equal(actionFor(ev("w", { metaKey: true }), true), "closePane");
  assert.equal(
    actionFor(ev("W", { metaKey: true, shiftKey: true }), true),
    "closeWorkspace",
  );
  assert.equal(
    actionFor(ev("T", { metaKey: true, shiftKey: true }), true),
    "reopenTab",
  );
  assert.equal(actionFor(ev("t", { metaKey: true }), true), "quickConnect");
  assert.equal(actionFor(ev("k", { metaKey: true }), true), "clearTerminal");
  assert.equal(
    actionFor(ev("}", { metaKey: true, shiftKey: true }, "BracketRight"), true),
    "nextTab",
  );
  assert.equal(actionFor(ev("Tab", { ctrlKey: true }), true), "nextTab");
  assert.equal(
    actionFor(ev("Tab", { ctrlKey: true, shiftKey: true }), true),
    "prevTab",
  );
  assert.equal(actionFor(ev("9", { metaKey: true }), true), "gotoTab");
  assert.equal(actionFor(ev("=", { metaKey: true }), true), "zoomIn");
  assert.equal(
    actionFor(ev("+", { metaKey: true, shiftKey: true }), true),
    "zoomIn",
  );
  assert.equal(actionFor(ev(",", { metaKey: true }), true), "openSettings");
  assert.equal(
    actionFor(ev("ArrowLeft", { metaKey: true, altKey: true }), true),
    "prevPane",
  );
  assert.equal(
    actionFor(
      ev("ArrowLeft", { metaKey: true, altKey: true, shiftKey: true }),
      true,
    ),
    "moveTabLeft",
  );
});

test("plain keys and extra modifiers never match", () => {
  assert.equal(actionFor(ev("w"), true), undefined);
  assert.equal(
    actionFor(ev("w", { metaKey: true, altKey: true }), true),
    undefined,
  );
  assert.equal(actionFor(ev("w", { ctrlKey: true }), false), undefined);
});

test("other platforms keep Ctrl+letter free for the shell", () => {
  assert.equal(
    actionFor(ev("W", { ctrlKey: true, shiftKey: true }), false),
    "closePane",
  );
  assert.equal(
    actionFor(ev("T", { ctrlKey: true, shiftKey: true }), false),
    "quickConnect",
  );
  assert.equal(
    actionFor(ev("T", { ctrlKey: true, shiftKey: true, altKey: true }), false),
    "reopenTab",
  );
});

test("no two actions share a binding on either platform", () => {
  for (const mac of [true, false]) {
    const seen = new Map();
    for (const s of SHORTCUTS)
      for (const c of s.combos) {
        const text = format(c, mac);
        assert.ok(!seen.has(text), `${text}: ${seen.get(text)} / ${s.id}`);
        seen.set(text, s.id);
      }
  }
});

test("format", () => {
  const closePane = SHORTCUTS.find((s) => s.id === "closePane").combos[0];
  assert.equal(format(closePane, true), "⌘W");
  assert.equal(format(closePane, false), "Ctrl+Maiusc+W");
});
