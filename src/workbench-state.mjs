export function reorderTabs(tabs, movingId, targetId) {
  const from = tabs.findIndex((tab) => tab.id === movingId),
    to = tabs.findIndex((tab) => tab.id === targetId);
  if (from < 0 || to < 0 || from === to) return tabs;
  const next = [...tabs];
  const [tab] = next.splice(from, 1);
  next.splice(to, 0, tab);
  return next;
}
export function terminalInputChunks(text) {
  const chunks = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 8192, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
export function syncUrlForVault(raw, vaultId) {
  if (vaultId === "personal") return raw;
  const url = new URL(raw);
  let path = url.pathname.replace(/\/+$/, "");
  if (!path.includes("/vaults/")) {
    if (path.endsWith("/vault")) path = path.slice(0, -6);
    url.pathname = `${path}/vaults/${vaultId}`;
  }
  return url.toString().replace(/\/$/, "");
}
