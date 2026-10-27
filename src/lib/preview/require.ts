export type Args = Record<string, unknown>;

export function requireValue(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}
