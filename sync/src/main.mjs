import { once } from "node:events";
import { createSyncServer } from "./app.mjs";
import { readConfig } from "./config.mjs";

const SHUTDOWN_GRACE_MS = 10_000;

/** Starts the server from environment variables and stops it on SIGTERM/SIGINT. */
export async function run(env) {
  let server;
  let config;
  try {
    config = readConfig(env);
    server = await createSyncServer({
      ...config,
      onError: (error) =>
        console.error(`Storage error: ${error.code ?? error.message}`),
    });
  } catch (error) {
    console.error(`Shellnest Sync cannot start: ${error.message}`);
    process.exit(1);
  }
  server.listen(config.port, config.host);
  try {
    await once(server, "listening");
  } catch (error) {
    console.error(
      `Shellnest Sync cannot listen on ${config.host}:${config.port}: ${error.message}`,
    );
    process.exit(1);
  }
  const { address, port } = server.address();
  console.log(
    `Shellnest Sync listening on ${address}:${port}, data in ${config.directory}`,
  );
  if (!["127.0.0.1", "::1"].includes(address))
    console.log("Not loopback: put it behind an HTTPS reverse proxy.");

  const stop = (signal) => {
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
