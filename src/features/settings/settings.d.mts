export type TerminalColors = Record<string, string>;
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
};
export const DEFAULT_FONT_SIZE: number;
export const MIN_FONT_SIZE: number;
export const MAX_FONT_SIZE: number;
export const DEFAULT_FONT_STACK: string;
export const TERMINAL_THEMES: {
  id: string;
  name: string;
  colors: TerminalColors;
}[];
export const DEFAULT_SETTINGS: AppSettings;
export function clampFontSize(n: number): number;
export function fontStack(family: string): string;
export function terminalTheme(id: string): {
  id: string;
  name: string;
  colors: TerminalColors;
};
export function parseSettings(text: string | null): AppSettings;
