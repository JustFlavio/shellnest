import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createSyncServer } from "./app.ts";
import { readConfig } from "./config.ts";

const SHUTDOWN_GRACE_MS = 10_000;

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Starts the server from environment variables and stops it on SIGTERM/SIGINT. */
export async function run(env: NodeJS.ProcessEnv) {
  let server: Awaited<ReturnType<typeof createSyncServer>>;
  let config: ReturnType<typeof readConfig>;
  try {
    config = readConfig(env);
    server = await createSyncServer({
      ...config,
      onError: (error) =>
        console.error(
          `Storage error: ${(error as NodeJS.ErrnoException).code ?? messageOf(error)}`,
        ),
    });
  } catch (error) {
    console.error(`Shellnest Sync cannot start: ${messageOf(error)}`);
    process.exit(1);
  }
  server.listen(config.port, config.host);
  try {
    await once(server, "listening");
  } catch (error) {
    console.error(
      `Shellnest Sync cannot listen on ${config.host}:${config.port}: ${messageOf(error)}`,
    );
    process.exit(1);
  }
  const { address, port } = server.address() as AddressInfo;
  console.log(
    `Shellnest Sync listening on ${address}:${port}, data in ${config.directory}`,
  );
  if (!["127.0.0.1", "::1"].includes(address))
    console.log("Not loopback: put it behind an HTTPS reverse proxy.");

  const stop = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    // In-flight requests (and their disk writes) finish; idle keep-alive sockets close now.
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}
