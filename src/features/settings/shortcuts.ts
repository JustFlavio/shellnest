import { t } from "../../i18n/i18n.ts";
// Shortcut registry. A combo is { key, mod?, ctrl?, shift?, alt? }: `mod` is Cmd on macOS and Ctrl elsewhere, `ctrl` is the literal Control key.
// Elsewhere letter combos also need Shift (and Alt when the combo already has Shift) so Ctrl+<letter> stays free for the shell,
// unless the combo is `plain` (bare Ctrl+<letter>: the app takes the key only where it can use it, see useShortcuts).
export type Combo = {
  key: string;
  mod?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  plain?: boolean;
};
// `label` is a getter on the registry: it reads the active language when it is asked for.
// `other` replaces `combos` on Windows and Linux where the Shift or Alt the derivation adds would make three or four keys.
export type Binding = {
  id: string;
  label: string;
  combos: Combo[];
  other?: Combo[];
};
type KeyEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

const arrow = (key: string, extra?: Partial<Combo>): Combo => ({
  key,
  mod: true,
  ...extra,
});
export const SHORTCUTS: Binding[] = [
  {
    id: "quickConnect",
    get label() {
      return t("hosts.vaultHeader.quickConnect");
    },
    combos: [{ key: "t", mod: true }],
  },
  {
    id: "newLocal",
    get label() {
      return t("hosts.vaultToolbar.localTerminal");
    },
    combos: [{ key: "l", mod: true }],
  },
  {
    id: "jumpTab",
    get label() {
      return t("settings.shortcuts.goToTab");
    },
    combos: [{ key: "j", mod: true }],
  },
  {
    id: "newHost",
    get label() {
      return t("hosts.hostEditor.newHost");
    },
    combos: [{ key: "n", mod: true }],
  },
  {
    id: "newFolder",
    get label() {
      return t("hosts.vaultToolbar.newFolder");
    },
    combos: [{ key: "n", mod: true, shift: true }],
    other: [{ key: "o", mod: true }],
  },
  {
    id: "searchVault",
    get label() {
      return t("settings.shortcuts.searchTheCollection");
    },
    combos: [{ key: "f", mod: true, shift: true }],
    other: [{ key: "f", mod: true }],
  },
  {
    id: "lockVault",
    get label() {
      return t("vault.vaultPanels.lockVault");
    },
    combos: [{ key: "l", mod: true, shift: true }],
    other: [{ key: "x", mod: true }],
  },
  {
    id: "openSettings",
    get label() {
      return t("app.appMenu.settings");
    },
    combos: [{ key: ",", mod: true }],
  },
  {
    id: "closePane",
    get label() {
      return t("settings.shortcuts.closePaneOrTab");
    },
    combos: [{ key: "w", mod: true }],
  },
  {
    id: "closeWorkspace",
    get label() {
      return t("settings.shortcuts.closeAllPanesOf");
    },
    combos: [{ key: "w", mod: true, shift: true }],
    other: [{ key: "q", mod: true }],
  },
  {
    id: "reopenTab",
    get label() {
      return t("settings.shortcuts.reopenLastClosedTab");
    },
    combos: [{ key: "t", mod: true, shift: true }],
    other: [{ key: "z", mod: true }],
  },
  {
    id: "gotoTab",
    get label() {
      return t("settings.shortcuts.goToTab1");
    },
    combos: [{ key: "1-9", mod: true }],
  },
  {
    id: "prevTab",
    get label() {
      return t("settings.shortcuts.previousTab");
    },
    combos: [
      { key: "[", mod: true, shift: true },
      { key: "Tab", ctrl: true, shift: true },
    ],
  },
  {
    id: "nextTab",
    get label() {
      return t("settings.shortcuts.nextTab");
    },
    combos: [
      { key: "]", mod: true, shift: true },
      { key: "Tab", ctrl: true },
    ],
  },
  {
    id: "moveTabLeft",
    get label() {
      return t("settings.shortcuts.moveTabLeft");
    },
    combos: [arrow("ArrowLeft", { shift: true, alt: true })],
    other: [{ key: "PageUp", mod: true, shift: true }],
  },
  {
    id: "moveTabRight",
    get label() {
      return t("settings.shortcuts.moveTabRight");
    },
    combos: [arrow("ArrowRight", { shift: true, alt: true })],
    other: [{ key: "PageDown", mod: true, shift: true }],
  },
  {
    id: "splitRight",
    get label() {
      return t("settings.shortcuts.splitThePaneTo");
    },
    combos: [{ key: "d", mod: true }],
  },
  {
    id: "splitDown",
    get label() {
      return t("settings.shortcuts.splitThePaneDown");
    },
    combos: [{ key: "d", mod: true, shift: true }],
    other: [{ key: "e", mod: true }],
  },
  {
    id: "prevPane",
    get label() {
      return t("settings.shortcuts.previousPane");
    },
    combos: [
      arrow("ArrowLeft", { alt: true }),
      arrow("ArrowUp", { alt: true }),
    ],
    other: [
      { key: "ArrowLeft", alt: true },
      { key: "ArrowUp", alt: true },
    ],
  },
  {
    id: "nextPane",
    get label() {
      return t("settings.shortcuts.nextPane");
    },
    combos: [
      arrow("ArrowRight", { alt: true }),
      arrow("ArrowDown", { alt: true }),
    ],
    other: [
      { key: "ArrowRight", alt: true },
      { key: "ArrowDown", alt: true },
    ],
  },
  {
    id: "clearTerminal",
    get label() {
      return t("settings.shortcuts.clearTerminal");
    },
    combos: [{ key: "k", mod: true }],
  },
  {
    id: "broadcast",
    get label() {
      return t("settings.shortcuts.broadcastInput");
    },
    combos: [{ key: "b", mod: true, plain: true }],
  },
  {
    id: "zoomIn",
    get label() {
      return t("settings.shortcuts.increaseTerminalTextSize");
    },
    combos: [{ key: "+", mod: true }],
  },
  {
    id: "zoomOut",
    get label() {
      return t("settings.shortcuts.decreaseTerminalTextSize");
    },
    combos: [{ key: "-", mod: true }],
  },
  {
    id: "zoomReset",
    get label() {
      return t("settings.shortcuts.defaultTextSize");
    },
    combos: [{ key: "0", mod: true }],
  },
];

// Normalised key of an event: the typed character when it is a letter or digit, else the physical key (Option and Shift change e.key).
const keyOf = (e: KeyEvent): string => {
  const k = e.key.toLowerCase();
  if (/^[a-z0-9]$/.test(k)) return k;
  if (k === "=" || k === "+") return "+";
  const c = /^(?:Key|Digit)(.)$/.exec(e.code);
  if (c) return c[1].toLowerCase();
  if (e.code === "BracketLeft") return "[";
  if (e.code === "BracketRight") return "]";
  return e.key.length === 1 ? k : e.key;
};

const keyMatches = (e: KeyEvent, key: string): boolean =>
  key === "1-9"
    ? /^[1-9]$/.test(keyOf(e))
    : keyOf(e).toLowerCase() === key.toLowerCase();

function matches(e: KeyEvent, combo: Combo, mac: boolean): boolean {
  const letter = /^[a-z]$/i.test(combo.key) && !combo.plain;
  const shift = !!combo.shift || (!mac && !!combo.mod && letter);
  const alt = !!combo.alt || (!mac && !!combo.mod && letter && !!combo.shift);
  const meta = mac && !!combo.mod;
  const ctrl = (!mac && !!combo.mod) || !!combo.ctrl;
  // "+" is typed with Shift on some layouts, so Shift is not checked for it.
  return (
    e.metaKey === meta &&
    e.ctrlKey === ctrl &&
    e.altKey === alt &&
    (combo.key === "+" || e.shiftKey === shift) &&
    keyMatches(e, combo.key)
  );
}

export function actionFor(
  e: KeyEvent,
  mac: boolean,
  bindings: Binding[] = resolve({}, mac),
): string | undefined {
  return bindings.find((s) => s.combos.some((c) => matches(e, c, mac)))?.id;
}

const names: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};
export function format(combo: Combo, mac: boolean): string {
  const key =
    names[combo.key] ??
    (combo.key === "1-9"
      ? "1–9"
      : combo.key.length === 1
        ? combo.key.toUpperCase()
        : combo.key);
  const letter = /^[a-z]$/i.test(combo.key) && !combo.plain;
  const shift = !!combo.shift || (!mac && !!combo.mod && letter);
  const alt = !!combo.alt || (!mac && !!combo.mod && letter && !!combo.shift);
  if (mac)
    return `${combo.ctrl ? "⌃" : ""}${alt ? "⌥" : ""}${shift ? "⇧" : ""}${combo.mod ? "⌘" : ""}${key}`;
  return [
    combo.mod || combo.ctrl ? t("settings.shortcuts.ctrl") : "",
    alt ? t("settings.shortcuts.alt") : "",
    shift ? t("settings.shortcuts.shift") : "",
    key,
  ]
    .filter(Boolean)
    .join("+");
}

export const hint = (
  id: string,
  mac: boolean,
  bindings: Binding[] = resolve({}, mac),
): string => {
  // callers pass registry ids, so the binding exists
  const combo = bindings.find((s) => s.id === id)!.combos[0];
  return combo ? format(combo, mac) : "";
};

export const defaultCombos = (s: Binding, mac: boolean): Combo[] =>
  (!mac && s.other) || s.combos;

export const resolve = (
  overrides: Record<string, Combo[]> = {},
  mac = false,
): Binding[] =>
  SHORTCUTS.map((s) => ({
    ...s,
    combos: overrides[s.id] ?? defaultCombos(s, mac),
  }));

type RawCombo = Record<string, unknown>;
const flags = ["mod", "ctrl", "shift", "alt"] as const;
// Ignores unknown actions and malformed combos, so a corrupt or outdated store falls back to the defaults.
export function parseOverrides(text: string): Record<string, Combo[]> {
  const out: Record<string, Combo[]> = {};
  try {
    const raw: Record<string, unknown> = JSON.parse(text);
    for (const s of SHORTCUTS) {
      const list = raw[s.id];
      if (!Array.isArray(list)) continue;
      const combos: Combo[] = list
        .filter((c: RawCombo | null) => c && typeof c.key === "string" && c.key)
        .map((c: RawCombo) => ({
          key: c.key as string,
          ...Object.fromEntries(
            flags.filter((f) => c[f] === true).map((f) => [f, true]),
          ),
        }));
      if (combos.length === list.length) out[s.id] = combos;
    }
  } catch {}
  return out;
}

// The combo the user just pressed, in registry form; null for a lone modifier or a key without Cmd/Ctrl/Alt.
export function comboFromEvent(
  e: KeyEvent,
  mac: boolean,
  id: string,
): Combo | null {
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return null;
  let key = keyOf(e);
  if (id === "gotoTab" && /^[1-9]$/.test(key)) key = "1-9";
  const letter = /^[a-z]$/.test(key);
  let c: Omit<Combo, "key">;
  if (mac)
    c = { mod: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey };
  else if (e.metaKey) return null;
  else if (!e.ctrlKey) c = { shift: e.shiftKey, alt: e.altKey };
  else if (!letter) c = { mod: true, shift: e.shiftKey, alt: e.altKey };
  else if (e.shiftKey) c = { mod: true, shift: e.altKey };
  else c = { ctrl: true, alt: e.altKey };
  if (!c.mod && !c.ctrl && !c.alt) return null;
  return { key, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v)) };
}

// Why a combo cannot be bound, or "" when it can.
export function reservedReason(combo: Combo, mac: boolean): string {
  const letter = /^[a-z]$/.test(combo.key);
  if (combo.ctrl && letter && !combo.shift && !combo.alt)
    return t("settings.shortcuts.isReservedForTerminal");
  if (mac && combo.mod && !combo.alt) {
    if (!combo.shift && "cvxazqhm".includes(combo.key) && letter)
      return t("settings.shortcuts.isReservedByThe");
    if (combo.shift && combo.key === "z")
      return t("settings.shortcuts.isReservedByThe");
  }
  return "";
}

export const findConflict = (
  bindings: Binding[],
  id: string,
  combo: Combo,
  mac: boolean,
): Binding | undefined =>
  bindings.find(
    (s) =>
      s.id !== id &&
      s.combos.some((c) => format(c, mac) === format(combo, mac)),
  );
