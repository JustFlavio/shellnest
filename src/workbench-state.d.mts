export function reorderTabs<T extends { id: string }>(
  tabs: T[],
  movingId: string,
  targetId: string,
): T[];
export function terminalInputChunks(text: string): string[];
export function syncUrlForVault(raw: string, vaultId: string): string;
