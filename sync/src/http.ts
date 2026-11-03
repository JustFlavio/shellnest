import type { IncomingMessage, ServerResponse } from "node:http";

export type HttpError = Error & { status: number };

export const httpError = (status: number, message: string): HttpError =>
  Object.assign(new Error(message), { status });

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof Error && typeof (error as HttpError).status === "number";

/** Vault contents are capped at 8 MiB; every other request is small. */
export const MAX_VAULT_BYTES = 8 * 1024 * 1024;
export const MAX_SMALL_BYTES = 64 * 1024;

/**
 * Reads a JSON object body. Size is capped on both the declared Content-Length
 * and the bytes actually received.
 */
export async function readJson(
  req: IncomingMessage,
  max: number,
): Promise<Record<string, unknown>> {
  if (Number(req.headers["content-length"] ?? 0) > max)
    throw httpError(413, "Too large");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw httpError(413, "Too large");
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw httpError(400, "Invalid JSON");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw httpError(400, "Invalid body");
  return value as Record<string, unknown>;
}

export function reply(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}
