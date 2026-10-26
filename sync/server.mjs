import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";

const digest = (value) => createHash("sha256").update(value).digest();
const revision = (bytes) => `"${digest(bytes).toString("hex")}"`;
const MAX_BYTES = 8 * 1024 * 1024;
function envelope(value) {
  if (
    !value ||
    value.version !== 1 ||
    !["salt", "nonce", "ciphertext"].every((k) => typeof value[k] === "string")
  )
    return false;
  const valid = (s, length) =>
    /^[A-Za-z0-9+/]+={0,2}$/.test(s) &&
    Buffer.from(s, "base64").toString("base64") === s &&
    (length
      ? Buffer.from(s, "base64").length === length
      : Buffer.from(s, "base64").length >= 16);
  return (
    Object.keys(value).sort().join(",") === "ciphertext,nonce,salt,version" &&
    valid(value.salt, 16) &&
    valid(value.nonce, 24) &&
    valid(value.ciphertext)
  );
}

export async function createSyncServer({ token, directory }) {
  if (!token || token.length < 32)
    throw new Error("SYNC_TOKEN deve contenere almeno 32 caratteri casuali.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const expected = digest(`Bearer ${token}`);
  // shortcut: one deployment token authorizes every vault; add per-vault ACLs before multi-user hosting.
  // Serialize reads and conditional writes, including disk persistence.
  let queue = Promise.resolve();
  const server = http.createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reply = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (req.url === "/health" && req.method === "GET")
      return reply(200, { ok: true });
    if (!timingSafeEqual(expected, digest(req.headers.authorization ?? ""))) {
      req.resume();
      return reply(401, { error: "Unauthorized" });
    }
    const match = /^\/vaults\/([a-z0-9-]{1,64})$/.exec(req.url ?? "");
    const vaultId = req.url === "/vault" ? "personal" : match?.[1];
    if (!vaultId || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(vaultId)) {
      req.resume();
      return reply(404, { error: "Not found" });
    }
    if (!["GET", "PUT"].includes(req.method)) {
      req.resume();
      res.setHeader("Allow", "GET, PUT");
      return reply(405, { error: "Method not allowed" });
    }
    // Begin consuming the body immediately; cap both declared and actual size.
    const body = (async () => {
      if (req.method !== "PUT") {
        req.resume();
        return null;
      }
      if (Number(req.headers["content-length"] ?? 0) > MAX_BYTES) {
        req.resume();
        throw Object.assign(new Error("Too large"), { status: 413 });
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BYTES)
          throw Object.assign(new Error("Too large"), { status: 413 });
        chunks.push(chunk);
      }
      let value;
      try {
        value = JSON.parse(Buffer.concat(chunks));
      } catch {
        throw Object.assign(new Error("Invalid JSON"), { status: 400 });
      }
      if (!envelope(value))
        throw Object.assign(new Error("Invalid envelope"), { status: 400 });
      return Buffer.from(JSON.stringify(value));
    })();
    // Attach a handler immediately, so a queued request rejection is never unhandled.
    const parsed = body.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    queue = queue
      .then(async () => {
        const result = await parsed;
        if (result.error)
          return reply(result.error.status ?? 400, {
            error: result.error.message,
          });
        const file =
          vaultId === "personal"
            ? join(directory, "vault.json")
            : join(directory, "vaults", `${vaultId}.json`);
        let current = null;
        try {
          current = await readFile(file);
          if (!envelope(JSON.parse(current)))
            throw new Error("Invalid stored envelope");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (req.method === "GET") {
          if (!current) return reply(404, { error: "No vault" });
          res.writeHead(200, {
            "Content-Type": "application/json",
            ETag: revision(current),
          });
          return res.end(current);
        }
        if (
          current
            ? req.headers["if-match"] !== revision(current)
            : req.headers["if-none-match"] !== "*"
        )
          return reply(412, { error: "Revision conflict" });
        const next = result.value;
        await mkdir(dirname(file), { recursive: true, mode: 0o700 });
        if (current)
          await writeFile(
            join(dirname(file), `${basename(file, ".json")}.previous.json`),
            current,
            {
              mode: 0o600,
            },
          );
        await writeFile(`${file}.tmp`, next, { mode: 0o600, flush: true });
        await rename(`${file}.tmp`, file);
        res.setHeader("ETag", revision(next));
        return reply(200, { ok: true });
      })
      .catch(() => {
        if (!res.headersSent) reply(500, { error: "Storage unavailable" });
        else res.destroy();
      });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 32;
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const server = await createSyncServer({
    token: process.env.SYNC_TOKEN,
    directory: resolve(process.env.SYNC_DATA_DIR ?? "sync/data"),
  });
  const host = process.env.SYNC_HOST ?? "127.0.0.1";
  const port = Number(process.env.SYNC_PORT ?? 8787);
  server.listen(port, host, () =>
    console.log(
      `Shellnest Sync: http://${host}:${port} — configurare HTTPS per accesso remoto`,
    ),
  );
}
