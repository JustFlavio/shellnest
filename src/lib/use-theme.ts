import { useSyncExternalStore } from "react";
import type { Scheme } from "@/features/settings/app-themes.ts";

// The resolved light or dark scheme, set by applyAppearance; read where CSS variables cannot reach (toasts, xterm).
let current: Scheme = "dark";
const listeners = new Set<() => void>();

export function setScheme(next: Scheme) {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export const currentScheme = (): Scheme => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme(): Scheme {
  return useSyncExternalStore(subscribe, currentScheme);
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export const systemDark = (): boolean => darkQuery().matches;

const subscribeSystem = (listener: () => void) => {
  const query = darkQuery();
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribeSystem, systemDark);
}
