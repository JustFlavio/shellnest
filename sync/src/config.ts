import { resolve } from "node:path";

/**
 * Settings from the environment. Defaults are the safe ones: loopback only,
 * data under ./sync/data. The token is validated by `createAuthenticator`.
 */
export function readConfig(env: NodeJS.ProcessEnv) {
  const port = Number(env.SYNC_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error(`SYNC_PORT is not a valid port: ${env.SYNC_PORT}`);
  return {
    token: env.SYNC_TOKEN,
    host: env.SYNC_HOST || "127.0.0.1",
    port,
    directory: resolve(env.SYNC_DATA_DIR || "sync/data"),
  };
}
