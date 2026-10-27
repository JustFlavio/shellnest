import { resolve } from "node:path";
import { createSyncServer } from "./app.mjs";

export async function run(env) {
  const server = await createSyncServer({
    token: env.SYNC_TOKEN,
    directory: resolve(env.SYNC_DATA_DIR ?? "sync/data"),
  });
  const host = env.SYNC_HOST ?? "127.0.0.1";
  const port = Number(env.SYNC_PORT ?? 8787);
  server.listen(port, host, () =>
    console.log(`Shellnest Sync: http://${host}:${port}`),
  );
}
