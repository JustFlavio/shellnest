// Shortcut registry. A combo is { key, mod?, ctrl?, shift?, alt? }: `mod` is Cmd on macOS and Ctrl elsewhere, `ctrl` is the literal Control key.
// Elsewhere letter combos also need Shift (and Alt when the combo already has Shift) so Ctrl+<letter> stays free for the shell.
const arrow = (key, extra) => ({ key, mod: true, ...extra });
export const SHORTCUTS = [
  {
    id: "quickConnect",
    label: "Connessione rapida",
    combos: [{ key: "t", mod: true }],
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

const keyMatches = (e, key) => {
  if (key === "1-9") return /^[1-9]$/.test(e.key);
  if (key === "[" || key === "]")
    return e.code === (key === "[" ? "BracketLeft" : "BracketRight");
  if (key === "+") return e.key === "+" || e.key === "=";
  return e.key.toLowerCase() === key.toLowerCase();
};

export function matches(e, combo, mac) {
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

export function actionFor(e, mac) {
  return SHORTCUTS.find((s) => s.combos.some((c) => matches(e, c, mac)))?.id;
}

const names = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };
export function format(combo, mac) {
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

export const hint = (id, mac) =>
  format(SHORTCUTS.find((s) => s.id === id).combos[0], mac);
