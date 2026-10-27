import http from "node:http";
import { createAuthenticator } from "./auth.ts";
import { isHttpError, readEnvelope } from "./body.ts";
import { createStorage } from "./storage.ts";
import { vaultIdFromPath } from "./vault-id.ts";

/**
 * Builds the HTTP server (not yet listening).
 *
 * shortcut: one deployment token authorizes every vault; add per-vault ACLs
 * before multi-user hosting.
 */
export async function createSyncServer({
  token,
  directory,
  onError = () => {},
}: {
  token: unknown;
  directory: string;
  onError?: (error: unknown) => void;
}) {
  const authorized = createAuthenticator(token);
  const storage = await createStorage(directory);

  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reply = (status: number, value: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    // Refuse without reading a body we do not want: answer, then drop the connection.
    const reject = (status: number, error: string) => {
      res.setHeader("Connection", "close");
      reply(status, { error });
      res.once("finish", () => req.destroy());
    };

    if (req.url === "/health" && req.method === "GET")
      return reply(200, { ok: true });
    if (!authorized(req.headers.authorization))
      return reject(401, "Unauthorized");
    const vaultId = vaultIdFromPath(req.url ?? "");
    if (!vaultId) return reject(404, "Not found");
    if (req.method !== "GET" && req.method !== "PUT") {
      res.setHeader("Allow", "GET, PUT");
      return reject(405, "Method not allowed");
    }

    try {
      if (req.method === "GET") {
        req.resume();
        const stored = await storage.read(vaultId);
        if (!stored) return reply(404, { error: "No vault" });
        res.writeHead(200, {
          "Content-Type": "application/json",
          ETag: stored.etag,
        });
        return res.end(stored.bytes);
      }
      // The body is parsed before the storage queue, so a slow upload never blocks other requests.
      const bytes = await readEnvelope(req);
      const written = await storage.write(vaultId, bytes, {
        ifMatch: req.headers["if-match"],
        ifNoneMatch: req.headers["if-none-match"],
      });
      if (!written) return reply(412, { error: "Revision conflict" });
      res.setHeader("ETag", written.etag);
      return reply(200, { ok: true });
    } catch (error) {
      if (isHttpError(error)) return reject(error.status, error.message);
      onError(error);
      if (!res.headersSent) reply(500, { error: "Storage unavailable" });
      else res.destroy();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 32;
  return server;
}
