// Interface palettes. Each theme has a light and a dark variant; the CSS variables in theme.css come from here.

export type Scheme = "light" | "dark";
export type ColorScheme = Scheme | "system";

export type Palette = {
  background: string;
  foreground: string;
  header: string;
  sidebar: string;
  field: string;
  card: string;
  accent: string;
  border: string;
  input: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  success: string;
  warning: string;
};

export type AppThemeDef = {
  id: string;
  name: string;
  light: Palette;
  dark: Palette;
};

export const COLOR_SCHEMES = ["system", "light", "dark"] as const;

export const APP_THEMES: AppThemeDef[] = [
  {
    id: "shellnest",
    name: "Shellnest",
    dark: {
      background: "#17140f",
      foreground: "#f4efe6",
      header: "#0f0d0a",
      sidebar: "#1e1a14",
      field: "#1e1a14",
      card: "#27221a",
      accent: "#3a2f1c",
      border: "#38322a",
      input: "#443d33",
      mutedForeground: "#a89f90",
      primary: "#f5a524",
      primaryForeground: "#1a1204",
      destructive: "#ff6b61",
      success: "#76c5a0",
      warning: "#d9ad58",
    },
    light: {
      background: "#fbf8f2",
      foreground: "#2a241b",
      header: "#f0e9dc",
      sidebar: "#f5f0e6",
      field: "#ffffff",
      card: "#ffffff",
      accent: "#f6e6c6",
      border: "#e7dfcf",
      input: "#d8cebb",
      mutedForeground: "#76695a",
      primary: "#a86300",
      primaryForeground: "#ffffff",
      destructive: "#cc3a2f",
      success: "#22845a",
      warning: "#9c6d0c",
    },
  },
  {
    id: "fjord",
    name: "Fjord",
    dark: {
      background: "#10151c",
      foreground: "#e6edf5",
      header: "#0a0e13",
      sidebar: "#151b24",
      field: "#151b24",
      card: "#1c2430",
      accent: "#1f3247",
      border: "#263140",
      input: "#313e50",
      mutedForeground: "#8d9aab",
      primary: "#5aa9ff",
      primaryForeground: "#04121f",
      destructive: "#ff6b6b",
      success: "#5cc8a0",
      warning: "#e0b45a",
    },
    light: {
      background: "#f6f8fb",
      foreground: "#1a2330",
      header: "#e7edf4",
      sidebar: "#eef2f7",
      field: "#ffffff",
      card: "#ffffff",
      accent: "#dbe8f8",
      border: "#dce3eb",
      input: "#c8d2de",
      mutedForeground: "#5d6a7a",
      primary: "#1f6fd1",
      primaryForeground: "#ffffff",
      destructive: "#cc3a3a",
      success: "#1d8660",
      warning: "#9c6d0c",
    },
  },
  {
    id: "moss",
    name: "Moss",
    dark: {
      background: "#12160f",
      foreground: "#ecf1e6",
      header: "#0b0e09",
      sidebar: "#181d14",
      field: "#181d14",
      card: "#20271b",
      accent: "#2a3a22",
      border: "#2d3527",
      input: "#3a4433",
      mutedForeground: "#9aa58f",
      primary: "#8fcf6b",
      primaryForeground: "#0d1a06",
      destructive: "#ff6b61",
      success: "#6cc79a",
      warning: "#d9b458",
    },
    light: {
      background: "#f7f9f4",
      foreground: "#1e2618",
      header: "#e9efe2",
      sidebar: "#f0f4eb",
      field: "#ffffff",
      card: "#ffffff",
      accent: "#dfedd3",
      border: "#dee5d6",
      input: "#c9d3bf",
      mutedForeground: "#606e57",
      primary: "#3f7d22",
      primaryForeground: "#ffffff",
      destructive: "#c8392f",
      success: "#22845a",
      warning: "#9c6d0c",
    },
  },
  {
    id: "iris",
    name: "Iris",
    dark: {
      background: "#15131c",
      foreground: "#efecf6",
      header: "#0e0c13",
      sidebar: "#1b1824",
      field: "#1b1824",
      card: "#241f30",
      accent: "#332a4a",
      border: "#302a3d",
      input: "#3d354e",
      mutedForeground: "#a29bb3",
      primary: "#a98bff",
      primaryForeground: "#170d33",
      destructive: "#ff6b81",
      success: "#6fcaa2",
      warning: "#e0b45a",
    },
    light: {
      background: "#f9f8fc",
      foreground: "#221d2e",
      header: "#ece9f4",
      sidebar: "#f3f1f8",
      field: "#ffffff",
      card: "#ffffff",
      accent: "#e7e0fb",
      border: "#e2deeb",
      input: "#cfc9de",
      mutedForeground: "#686178",
      primary: "#6a4bd8",
      primaryForeground: "#ffffff",
      destructive: "#c8334f",
      success: "#22845a",
      warning: "#9c6d0c",
    },
  },
  {
    id: "rose",
    name: "Rosé",
    dark: {
      background: "#1a1215",
      foreground: "#f6ecee",
      header: "#120c0e",
      sidebar: "#20171a",
      field: "#20171a",
      card: "#2b1f23",
      accent: "#43262f",
      border: "#3a2a2f",
      input: "#4a363c",
      mutedForeground: "#b19ca2",
      primary: "#ff7aa2",
      primaryForeground: "#2a0612",
      destructive: "#ff6b61",
      success: "#76c5a0",
      warning: "#e0b45a",
    },
    light: {
      background: "#fcf7f8",
      foreground: "#2c1d22",
      header: "#f3e8eb",
      sidebar: "#f8f0f2",
      field: "#ffffff",
      card: "#ffffff",
      accent: "#fadfe7",
      border: "#ecdfe3",
      input: "#dccad0",
      mutedForeground: "#776167",
      primary: "#c2335f",
      primaryForeground: "#ffffff",
      destructive: "#c8392f",
      success: "#22845a",
      warning: "#9c6d0c",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    dark: {
      background: "#141414",
      foreground: "#ededed",
      header: "#0c0c0c",
      sidebar: "#1a1a1a",
      field: "#1a1a1a",
      card: "#222222",
      accent: "#2e2e2e",
      border: "#2c2c2c",
      input: "#3a3a3a",
      mutedForeground: "#9a9a9a",
      primary: "#e8e8e8",
      primaryForeground: "#141414",
      destructive: "#ff6b61",
      success: "#6fcaa2",
      warning: "#dcb257",
    },
    light: {
      background: "#fafafa",
      foreground: "#1b1b1b",
      header: "#ededed",
      sidebar: "#f3f3f3",
      field: "#ffffff",
      card: "#ffffff",
      accent: "#e8e8e8",
      border: "#e2e2e2",
      input: "#cecece",
      mutedForeground: "#696969",
      primary: "#1b1b1b",
      primaryForeground: "#fafafa",
      destructive: "#c8392f",
      success: "#22845a",
      warning: "#9c6d0c",
    },
  },
];

export const appTheme = (id: string): AppThemeDef =>
  APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0];

export const resolveScheme = (
  preference: ColorScheme,
  systemDark: boolean,
): Scheme =>
  preference === "system" ? (systemDark ? "dark" : "light") : preference;

/** The CSS custom properties of a palette, named as in theme.css. */
export function themeVars(p: Palette): Record<string, string> {
  return {
    "--background": p.background,
    "--foreground": p.foreground,
    "--header": p.header,
    "--sidebar": p.sidebar,
    "--field": p.field,
    "--card": p.card,
    "--card-foreground": p.foreground,
    "--popover": p.card,
    "--popover-foreground": p.foreground,
    "--primary": p.primary,
    "--primary-foreground": p.primaryForeground,
    "--secondary": p.card,
    "--secondary-foreground": p.foreground,
    "--muted": p.card,
    "--muted-foreground": p.mutedForeground,
    "--accent": p.accent,
    "--accent-foreground": p.foreground,
    "--destructive": p.destructive,
    "--success": p.success,
    "--warning": p.warning,
    "--border": p.border,
    "--input": p.input,
    "--ring": p.primary,
  };
}

const channels = (hex: string): number[] => {
  const h = /^#([0-9a-f]{6})/i.exec(hex)?.[1] ?? "000000";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** `a` mixed into `b` by `amount` (0..1), as #rrggbb; alpha suffixes are ignored. */
export function mixHex(a: string, b: string, amount: number): string {
  const [x, y] = [channels(a), channels(b)];
  return (
    "#" +
    x
      .map((c, i) =>
        Math.round(c * amount + y[i] * (1 - amount))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
