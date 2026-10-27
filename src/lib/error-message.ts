/** The text of a rejected promise: Tauri rejects with a string, everything else with an Error. */
export function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/^(\w*Error: )+/, "").trim();
}

/** The same failure always gets the same id, so a repeat updates the toast already on screen. */
export function errorToastId(title: string, description: string): string {
  return `error:${title}:${description}`;
}
