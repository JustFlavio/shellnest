import { isEnvelope } from "./envelope.mjs";

export const MAX_BYTES = 8 * 1024 * 1024;

const httpError = (status, message) =>
  Object.assign(new Error(message), { status });

/**
 * Reads a PUT body and returns it re-serialized as canonical JSON, after
 * checking it is an encrypted envelope. Size is capped on both the declared
 * Content-Length and the bytes actually received.
 */
export async function readEnvelope(req) {
  if (Number(req.headers["content-length"] ?? 0) > MAX_BYTES)
    throw httpError(413, "Too large");
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw httpError(413, "Too large");
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks));
  } catch {
    throw httpError(400, "Invalid JSON");
  }
  if (!isEnvelope(value)) throw httpError(400, "Invalid envelope");
  return Buffer.from(JSON.stringify(value));
}
