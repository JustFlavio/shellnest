// The password typed for a quick connection waits here, outside the tab list and the page state,
// until the session starts and takes it. It is never stored anywhere else.
const held = new Map<string, string>();

export const holdQuickPassword = (tabId: string, password: string) =>
  void held.set(tabId, password);

export function takeQuickPassword(tabId: string) {
  const password = held.get(tabId);
  held.delete(tabId);
  return password;
}
