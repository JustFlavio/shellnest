// Shortcut registry. A combo is { key, mod?, ctrl?, shift?, alt? }: `mod` is Cmd on macOS and Ctrl elsewhere, `ctrl` is the literal Control key.
// Elsewhere letter combos also need Shift (and Alt when the combo already has Shift) so Ctrl+<letter> stays free for the shell.
export type Combo = {
  key: string;
  mod?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};
export type Binding = { id: string; label: string; combos: Combo[] };
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
    label: "Connessione rapida",
    combos: [{ key: "t", mod: true }],
  },
  {
    id: "jumpTab",
    label: "Vai alla scheda",
    combos: [{ key: "j", mod: true }],
  },
  { id: "newHost", label: "Nuovo host", combos: [{ key: "n", mod: true }] },
  {
    id: "newFolder",
    label: "Nuova cartella",
    combos: [{ key: "n", mod: true, shift: true }],
  },
  {
    id: "searchVault",
    label: "Cerca nella raccolta",
    combos: [{ key: "f", mod: true, shift: true }],
  },
  {
    id: "lockVault",
    label: "Blocca vault",
    combos: [{ key: "l", mod: true, shift: true }],
  },
  {
    id: "openSettings",
    label: "Impostazioni",
    combos: [{ key: ",", mod: true }],
  },
  {
    id: "closePane",
    label: "Chiudi pane o scheda",
    combos: [{ key: "w", mod: true }],
  },
  {
    id: "closeWorkspace",
    label: "Chiudi tutti i pane della scheda",
    combos: [{ key: "w", mod: true, shift: true }],
  },
  {
    id: "reopenTab",
    label: "Riapri ultima scheda chiusa",
    combos: [{ key: "t", mod: true, shift: true }],
  },
  {
    id: "gotoTab",
    label: "Vai alla scheda 1–8, 9 = ultima",
    combos: [{ key: "1-9", mod: true }],
  },
  {
    id: "prevTab",
    label: "Scheda precedente",
    combos: [
      { key: "[", mod: true, shift: true },
      { key: "Tab", ctrl: true, shift: true },
    ],
  },
  {
    id: "nextTab",
    label: "Scheda successiva",
    combos: [
      { key: "]", mod: true, shift: true },
      { key: "Tab", ctrl: true },
    ],
  },
  {
    id: "moveTabLeft",
    label: "Sposta scheda a sinistra",
    combos: [arrow("ArrowLeft", { shift: true, alt: true })],
  },
  {
    id: "moveTabRight",
    label: "Sposta scheda a destra",
    combos: [arrow("ArrowRight", { shift: true, alt: true })],
  },
  {
    id: "splitRight",
    label: "Dividi il pane a destra",
    combos: [{ key: "d", mod: true }],
  },
  {
    id: "splitDown",
    label: "Dividi il pane in basso",
    combos: [{ key: "d", mod: true, shift: true }],
  },
  {
    id: "prevPane",
    label: "Pane precedente",
    combos: [
      arrow("ArrowLeft", { alt: true }),
      arrow("ArrowUp", { alt: true }),
    ],
  },
  {
    id: "nextPane",
    label: "Pane successivo",
    combos: [
      arrow("ArrowRight", { alt: true }),
      arrow("ArrowDown", { alt: true }),
    ],
  },
  {
    id: "clearTerminal",
    label: "Pulisci terminale",
    combos: [{ key: "k", mod: true }],
  },
  {
    id: "zoomIn",
    label: "Ingrandisci testo del terminale",
    combos: [{ key: "+", mod: true }],
  },
  {
    id: "zoomOut",
    label: "Riduci testo del terminale",
    combos: [{ key: "-", mod: true }],
  },
  {
    id: "zoomReset",
    label: "Dimensione testo predefinita",
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

export function matches(e: KeyEvent, combo: Combo, mac: boolean): boolean {
  const letter = /^[a-z]$/i.test(combo.key);
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
  bindings: Binding[] = SHORTCUTS,
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
  const letter = /^[a-z]$/i.test(combo.key);
  const shift = !!combo.shift || (!mac && !!combo.mod && letter);
  const alt = !!combo.alt || (!mac && !!combo.mod && letter && !!combo.shift);
  if (mac)
    return `${combo.ctrl ? "⌃" : ""}${alt ? "⌥" : ""}${shift ? "⇧" : ""}${combo.mod ? "⌘" : ""}${key}`;
  return [
    combo.mod || combo.ctrl ? "Ctrl" : "",
    alt ? "Alt" : "",
    shift ? "Maiusc" : "",
    key,
  ]
    .filter(Boolean)
    .join("+");
}

export const hint = (
  id: string,
  mac: boolean,
  bindings: Binding[] = SHORTCUTS,
): string => {
  // callers pass registry ids, so the binding exists
  const combo = bindings.find((s) => s.id === id)!.combos[0];
  return combo ? format(combo, mac) : "";
};

export const resolve = (overrides: Record<string, Combo[]> = {}): Binding[] =>
  SHORTCUTS.map((s) => ({ ...s, combos: overrides[s.id] ?? s.combos }));

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
    return "è riservata ai comandi del terminale";
  if (mac && combo.mod && !combo.alt) {
    if (!combo.shift && "cvxazqhm".includes(combo.key) && letter)
      return "è riservata al sistema";
    if (combo.shift && combo.key === "z") return "è riservata al sistema";
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
