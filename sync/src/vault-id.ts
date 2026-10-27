// Same rule as `valid_vault_id` in src-tauri/src/vault.rs. Lowercase letters,
// digits and "-" only, so an id can never contain a path separator or a dot.
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
const VAULT_PATH = /^\/vaults\/([a-z0-9-]{1,64})$/;

export const LEGACY_VAULT = "personal";

/**
 * Vault id addressed by a request path, or null when the path is not a vault
 * route. `/vault` is the original single-vault route and maps to "personal".
 */
export function vaultIdFromPath(path: string) {
  const id = path === "/vault" ? LEGACY_VAULT : VAULT_PATH.exec(path)?.[1];
  return id && !RESERVED.test(id) ? id : null;
}
