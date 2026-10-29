export type Args = Record<string, unknown>;

/** Refuses like the Rust side does: with the `{ code, params }` the UI translates. */
export function requireValue(
  condition: unknown,
  code: string,
  params?: unknown,
): void {
  if (!condition) throw { code, params };
}
