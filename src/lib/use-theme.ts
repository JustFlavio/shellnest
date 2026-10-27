export type Theme = "light" | "dark" | "system";

// The app is dark-only for now; the owner will implement the real light/dark/system switch here and the toasts follow it.
export function useTheme(): Theme {
  return "dark";
}
