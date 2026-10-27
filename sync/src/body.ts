import type { IncomingMessage } from "node:http";
import { isEnvelope } from "./envelope.ts";

const MAX_BYTES = 8 * 1024 * 1024;

export type HttpError = Error & { status: number };

const httpError = (status: number, message: string): HttpError =>
  Object.assign(new Error(message), { status });

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof Error && typeof (error as HttpError).status === "number";

/**
 * Reads a PUT body and returns it re-serialized as canonical JSON, after
 * checking it is an encrypted envelope. Size is capped on both the declared
 * Content-Length and the bytes actually received.
 */
export async function readEnvelope(req: IncomingMessage) {
  if (Number(req.headers["content-length"] ?? 0) > MAX_BYTES)
    throw httpError(413, "Too large");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw httpError(413, "Too large");
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw httpError(400, "Invalid JSON");
  }
  if (!isEnvelope(value)) throw httpError(400, "Invalid envelope");
  return Buffer.from(JSON.stringify(value));
}
