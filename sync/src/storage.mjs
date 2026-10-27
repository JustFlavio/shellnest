import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isEnvelope, revision } from "./envelope.mjs";
import { LEGACY_VAULT } from "./vault-id.mjs";

/**
 * File storage for the encrypted containers.
 *
 *   <dir>/vault.json              the "personal" vault (original layout)
 *   <dir>/vaults/<id>.json        every other vault
 *   <dir>/vaults/<id>.previous.json  the version before the last write
 *
 * Reads and writes go through one queue, so the revision check and the write
 * of a conditional PUT are atomic with respect to every other request.
 */
export async function createStorage(directory) {
  await mkdir(join(directory, "vaults"), { recursive: true, mode: 0o700 });
  let queue = Promise.resolve();
  const serialized = (task) => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };
  const fileOf = (id, suffix = "") =>
    id === LEGACY_VAULT
      ? join(directory, `vault${suffix}.json`)
      : join(directory, "vaults", `${id}${suffix}.json`);

  async function load(id) {
    let bytes;
    try {
      bytes = await readFile(fileOf(id));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (!isEnvelope(JSON.parse(bytes)))
      throw new Error("Invalid stored envelope");
    return bytes;
  }
  // Write to a temporary file, then rename: a crash leaves the old or the new
  // file, never a truncated one.
  async function replace(file, bytes) {
    await writeFile(`${file}.tmp`, bytes, { mode: 0o600, flush: true });
    await rename(`${file}.tmp`, file);
    // Make the rename itself durable. Not supported everywhere (Windows), so best effort.
    try {
      const dir = await open(dirname(file));
      await dir.sync().finally(() => dir.close());
    } catch {}
  }

  return {
    /** `{ bytes, etag }` of the stored container, or null if there is none. */
    read: (id) =>
      serialized(async () => {
        const bytes = await load(id);
        return bytes && { bytes, etag: revision(bytes) };
      }),
    /**
     * Stores `bytes` if the precondition holds: `If-Match` must equal the
     * current ETag, or `If-None-Match: *` must be sent when nothing is stored.
     * Resolves to `{ etag }`, or null on a revision conflict.
     */
    write: (id, bytes, { ifMatch, ifNoneMatch }) =>
      serialized(async () => {
        const current = await load(id);
        if (current ? ifMatch !== revision(current) : ifNoneMatch !== "*")
          return null;
        if (current) await replace(fileOf(id, ".previous"), current);
        await replace(fileOf(id), bytes);
        return { etag: revision(bytes) };
      }),
  };
}
