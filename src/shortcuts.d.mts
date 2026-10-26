export type Combo = {
  key: string;
  mod?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};
export const SHORTCUTS: { id: string; label: string; combos: Combo[] }[];
export function matches(e: KeyboardEvent, combo: Combo, mac: boolean): boolean;
export type Binding = { id: string; label: string; combos: Combo[] };
export function actionFor(
  e: KeyboardEvent,
  mac: boolean,
  bindings?: Binding[],
): string | undefined;
export function format(combo: Combo, mac: boolean): string;
export function hint(id: string, mac: boolean, bindings?: Binding[]): string;
export function resolve(overrides?: Record<string, Combo[]>): Binding[];
export function parseOverrides(text: string): Record<string, Combo[]>;
export function comboFromEvent(
  e: KeyboardEvent,
  mac: boolean,
  id: string,
): Combo | null;
export function reservedReason(combo: Combo, mac: boolean): string;
export function findConflict(
  bindings: Binding[],
  id: string,
  combo: Combo,
  mac: boolean,
): Binding | undefined;
