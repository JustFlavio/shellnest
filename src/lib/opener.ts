// Which control opened a panel? Safari/WebKit does not focus a button on click, so
// document.activeElement can be a stale control. Track the latest interaction instead:
// a pointer press names its button, a key press leaves the focused element as is.
let pressed: HTMLElement | null = null;
let byPointer = false;

export function trackOpener() {
  document.addEventListener(
    "pointerdown",
    (event) => {
      pressed =
        ((event.target as Element | null)?.closest?.(
          "button",
        ) as HTMLElement | null) ?? null;
      byPointer = true;
    },
    true,
  );
  document.addEventListener("keydown", () => (byPointer = false), true);
}

export function currentOpener(): HTMLElement | null {
  if (byPointer) return pressed;
  const active = document.activeElement;
  return active && active !== document.body ? (active as HTMLElement) : null;
}
