export type Combo = {
  key: string;
  mod?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};
export const SHORTCUTS: { id: string; label: string; combos: Combo[] }[];
export function matches(e: KeyboardEvent, combo: Combo, mac: boolean): boolean;
export function actionFor(e: KeyboardEvent, mac: boolean): string | undefined;
export function format(combo: Combo, mac: boolean): string;
export function hint(id: string, mac: boolean): string;
