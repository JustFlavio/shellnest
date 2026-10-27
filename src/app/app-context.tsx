import { createContext, use } from "react";
import type { AppState } from "./useAppState";

export const AppContext = createContext<AppState | null>(null);

export function useApp() {
  const app = use(AppContext);
  if (!app) throw new Error("useApp must be used inside <AppContext>");
  return app;
}
