import type { View } from "../types";
import { requireValue } from "./require";
import type { Args } from "./require";

export function configureSync(next: View, args: Args): void {
  const url = new URL(String(args.url));
  requireValue(
    url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)),
    "Usa HTTPS per la sincronizzazione remota",
  );
  requireValue(
    next.syncConfigured ||
      (typeof args.token === "string" && args.token.length >= 32),
    "Il token deve contenere almeno 32 caratteri fittizi",
  );
  next.syncUrl = url.toString();
  next.syncConfigured = true;
}
