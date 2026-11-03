import { newToken, tokenHash } from "./auth.ts";
import { INVITE_DAYS } from "./app.ts";
import { openStore } from "./store.ts";

/**
 * `node server.ts invite [--admin]`: writes a one-time invite into the data
 * directory and prints its code. The running server reads invites from disk,
 * so this works while it is up. The first account needs `--admin`.
 */
export async function createInvite(directory: string, admin: boolean) {
  const store = await openStore(directory);
  const code = newToken();
  await store.writeInvite(tokenHash(code), {
    admin,
    expiresAt: Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
  });
  return code;
}
