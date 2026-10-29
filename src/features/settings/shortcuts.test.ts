import test from "node:test";
import assert from "node:assert/strict";
import { SHORTCUTS, actionFor, format } from "./shortcuts.ts";

const ev = (key: string, m: Record<string, unknown> = {}, code = "") => ({
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

test("newLocal: Cmd+L on macOS, Ctrl+Shift+L elsewhere, apart from lockVault", () => {
  assert.equal(actionFor(ev("l", { metaKey: true }), true), "newLocal");
  assert.equal(
    actionFor(ev("L", { metaKey: true, shiftKey: true }), true),
    "lockVault",
  );
  assert.equal(
    actionFor(ev("L", { ctrlKey: true, shiftKey: true }), false),
    "newLocal",
  );
  assert.equal(
    actionFor(ev("L", { ctrlKey: true, shiftKey: true, altKey: true }), false),
    "lockVault",
  );
  assert.equal(actionFor(ev("l", { ctrlKey: true }), false), undefined);
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
  const closePane = SHORTCUTS.find((s) => s.id === "closePane")!.combos[0]!;
  assert.equal(format(closePane, true), "⌘W");
  assert.equal(format(closePane, false), "Ctrl+Maiusc+W");
});

import {
  comboFromEvent,
  findConflict,
  parseOverrides,
  reservedReason,
  resolve,
} from "./shortcuts.ts";
import { i18n } from "../../i18n/i18n.ts";

// These assertions read the Italian copy.
await i18n.changeLanguage("it");

test("comboFromEvent round-trips through matching", () => {
  for (const mac of [true, false])
    for (const s of SHORTCUTS)
      for (const c of s.combos) {
        if (c.key === "1-9") continue;
        // Build the event a user would press for this combo.
        const shiftLetter =
          !mac && !!c.mod && !c.plain && /^[a-z]$/.test(c.key);
        const e = ev(
          c.shift && !shiftLetter && c.key.length === 1
            ? c.key.toUpperCase()
            : c.key,
          {
            metaKey: mac && !!c.mod,
            ctrlKey: (!mac && !!c.mod) || !!c.ctrl,
            shiftKey: !!c.shift || shiftLetter,
            altKey: !!c.alt || (shiftLetter && !!c.shift),
          },
          c.key === "[" ? "BracketLeft" : c.key === "]" ? "BracketRight" : "",
        );
        assert.equal(
          format(comboFromEvent(e, mac, s.id)!, mac),
          format(c, mac),
        );
        assert.equal(actionFor(e, mac), s.id);
      }
});

test("comboFromEvent rejects lone modifiers and unmodified keys", () => {
  assert.equal(comboFromEvent(ev("Meta", { metaKey: true }), true, "x"), null);
  assert.equal(comboFromEvent(ev("a"), true, "x"), null);
  assert.equal(comboFromEvent(ev("A", { shiftKey: true }), true, "x"), null);
  assert.deepEqual(
    comboFromEvent(ev("5", { metaKey: true }), true, "gotoTab"),
    { key: "1-9", mod: true },
  );
});

test("reserved combos", () => {
  assert.ok(reservedReason({ key: "q", mod: true }, true));
  assert.ok(reservedReason({ key: "c", ctrl: true }, true));
  assert.equal(reservedReason({ key: "j", mod: true }, true), "");
});

test("overrides replace defaults, bad input falls back", () => {
  const b = resolve({ closePane: [{ key: "x", mod: true }] });
  assert.equal(actionFor(ev("x", { metaKey: true }), true, b), "closePane");
  assert.equal(actionFor(ev("w", { metaKey: true }), true, b), undefined);
  assert.deepEqual(parseOverrides("nope"), {});
  assert.deepEqual(
    parseOverrides('{"closePane":[{"nokey":1}],"ghost":[]}'),
    {},
  );
  assert.deepEqual(parseOverrides('{"closePane":[]}'), { closePane: [] });
  assert.equal(
    findConflict(resolve(), "closePane", { key: "t", mod: true }, true)?.id,
    "quickConnect",
  );
});

test("broadcast input is plain Cmd+B / Ctrl+B, without the Shift other Ctrl letters need", () => {
  assert.equal(actionFor(ev("b", { metaKey: true }), true), "broadcast");
  assert.equal(actionFor(ev("b", { ctrlKey: true }), false), "broadcast");
  assert.equal(
    actionFor(ev("B", { ctrlKey: true, shiftKey: true }), false),
    undefined,
  );
  assert.equal(actionFor(ev("b", { ctrlKey: true }), true), undefined);
  assert.equal(
    format(SHORTCUTS.find((s) => s.id === "broadcast")!.combos[0], true),
    "⌘B",
  );
  assert.equal(
    format(SHORTCUTS.find((s) => s.id === "broadcast")!.combos[0], false),
    "Ctrl+B",
  );
});
