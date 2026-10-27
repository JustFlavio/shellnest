// App settings: one flat object in localStorage. Parsing never throws; every bad field falls back to its default.
type TerminalColors = Record<string, string>;
export type TerminalThemeDef = {
  id: string;
  name: string;
  colors: TerminalColors;
};
export type AppSettings = {
  fontFamily: string;
  fontSize: number;
  terminalTheme: string;
  copyOnSelect: boolean;
  rightClickPaste: boolean;
  bell: boolean;
  optionAsMeta: boolean;
  brightBold: boolean;
  scrollback: number;
  checkUpdates: boolean;
};

export const DEFAULT_FONT_SIZE = 13;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 32;
const DEFAULT_FONT_STACK =
  '"Cascadia Code", "SFMono-Regular", Consolas, monospace';

const ansi = (c: string[]): TerminalColors => ({
  black: c[0],
  red: c[1],
  green: c[2],
  yellow: c[3],
  blue: c[4],
  magenta: c[5],
  cyan: c[6],
  white: c[7],
  brightBlack: c[8],
  brightRed: c[9],
  brightGreen: c[10],
  brightYellow: c[11],
  brightBlue: c[12],
  brightMagenta: c[13],
  brightCyan: c[14],
  brightWhite: c[15],
});

export const TERMINAL_THEMES: TerminalThemeDef[] = [
  {
    id: "shellnest",
    name: "Shellnest",
    colors: {
      background: "#17140f",
      foreground: "#f4efe6",
      cursor: "#f5a524",
      selectionBackground: "#f5a52433",
    },
  },
  {
    id: "nord",
    name: "Nord",
    colors: {
      background: "#2e3440",
      foreground: "#d8dee9",
      cursor: "#d8dee9",
      selectionBackground: "#434c5ecc",
      ...ansi([
        "#3b4252",
        "#bf616a",
        "#a3be8c",
        "#ebcb8b",
        "#81a1c1",
        "#b48ead",
        "#88c0d0",
        "#e5e9f0",
        "#4c566a",
        "#bf616a",
        "#a3be8c",
        "#ebcb8b",
        "#81a1c1",
        "#b48ead",
        "#8fbcbb",
        "#eceff4",
      ]),
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    colors: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#f8f8f2",
      selectionBackground: "#44475acc",
      ...ansi([
        "#21222c",
        "#ff5555",
        "#50fa7b",
        "#f1fa8c",
        "#bd93f9",
        "#ff79c6",
        "#8be9fd",
        "#f8f8f2",
        "#6272a4",
        "#ff6e6e",
        "#69ff94",
        "#ffffa5",
        "#d6acff",
        "#ff92df",
        "#a4ffff",
        "#ffffff",
      ]),
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    colors: {
      background: "#002b36",
      foreground: "#839496",
      cursor: "#93a1a1",
      selectionBackground: "#073642cc",
      ...ansi([
        "#073642",
        "#dc322f",
        "#859900",
        "#b58900",
        "#268bd2",
        "#d33682",
        "#2aa198",
        "#eee8d5",
        "#002b36",
        "#cb4b16",
        "#586e75",
        "#657b83",
        "#839496",
        "#6c71c4",
        "#93a1a1",
        "#fdf6e3",
      ]),
    },
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  // "" = the default stack
  fontFamily: "",
  fontSize: DEFAULT_FONT_SIZE,
  terminalTheme: "shellnest",
  copyOnSelect: false,
  rightClickPaste: true,
  bell: false,
  // Off: Italian layouts type @ # [ ] with Option.
  optionAsMeta: false,
  brightBold: false,
  scrollback: 5000,
  checkUpdates: true,
};

export const clampFontSize = (n: number): number =>
  Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(n)));

export const fontStack = (family: string): string => {
  const f = family.trim();
  if (!f) return DEFAULT_FONT_STACK;
  return f.includes('"') || f.includes(",") ? f : `"${f}", monospace`;
};

export const terminalTheme = (id: string): TerminalThemeDef =>
  TERMINAL_THEMES.find((t) => t.id === id) ?? TERMINAL_THEMES[0];

type BoolKey = {
  [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never;
}[keyof AppSettings];
type NumKey = {
  [K in keyof AppSettings]: AppSettings[K] extends number ? K : never;
}[keyof AppSettings];

export function parseSettings(text: string | null): AppSettings {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(text ?? "");
    if (parsed && typeof parsed === "object") raw = parsed;
  } catch {}
  const d = DEFAULT_SETTINGS;
  const bool = (k: BoolKey): boolean => {
    const v = raw[k];
    return typeof v === "boolean" ? v : d[k];
  };
  const int = (k: NumKey, min: number, max: number): number => {
    const v = raw[k];
    return typeof v === "number" && Number.isFinite(v)
      ? Math.min(max, Math.max(min, Math.round(v)))
      : d[k];
  };
  return {
    fontFamily:
      typeof raw.fontFamily === "string" &&
      raw.fontFamily.length <= 200 &&
      !/[\x00-\x1f]/.test(raw.fontFamily)
        ? raw.fontFamily
        : d.fontFamily,
    fontSize: int("fontSize", MIN_FONT_SIZE, MAX_FONT_SIZE),
    terminalTheme:
      TERMINAL_THEMES.find((t) => t.id === raw.terminalTheme)?.id ??
      d.terminalTheme,
    copyOnSelect: bool("copyOnSelect"),
    rightClickPaste: bool("rightClickPaste"),
    bell: bool("bell"),
    optionAsMeta: bool("optionAsMeta"),
    brightBold: bool("brightBold"),
    scrollback: int("scrollback", 500, 100000),
    checkUpdates: bool("checkUpdates"),
  };
}
