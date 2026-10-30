import type {
  Conflict,
  FileEntry,
  Side,
  Transfer,
  TransferProgress,
  TransferRequest,
} from "./types.ts";
import { transferProgress } from "./file-state.ts";

/** Owns sequential execution; view switches never restart or advance a transfer. */
export class TransferQueue {
  private items: Transfer[] = [];
  private active: string | null = null;
  private ready = false;
  private readonly start: (request: TransferRequest) => Promise<unknown>;
  private readonly stop: (id: string) => Promise<unknown>;
  private readonly changed: (items: Transfer[]) => void;
  private readonly failure: (error: unknown) => TransferProgress["error"];
  constructor(
    start: (request: TransferRequest) => Promise<unknown>,
    stop: (id: string) => Promise<unknown>,
    changed: (items: Transfer[]) => void,
    failure: (error: unknown) => TransferProgress["error"],
  ) {
    this.start = start;
    this.stop = stop;
    this.changed = changed;
    this.failure = failure;
  }
  private publish() {
    this.changed([...this.items]);
  }
  private pump() {
    if (
      !this.ready ||
      this.active ||
      this.items.some((x) => x.status === "conflict")
    )
      return;
    const next = this.items.find((x) => x.status === "queued");
    if (!next) return;
    this.active = next.id;
    this.items = this.items.map((x) =>
      x.id === next.id ? { ...x, status: "running" } : x,
    );
    this.publish();
    void this.start(next.request).catch((error) =>
      this.progress({
        id: next.id,
        bytes: next.bytes,
        current: next.current,
        status: "failed",
        error: this.failure(error),
      }),
    );
  }
  connected() {
    this.ready = true;
    this.pump();
  }
  disconnected() {
    this.ready = false;
    this.active = null;
    this.items = this.items.map((x) =>
      ["queued", "running", "conflict"].includes(x.status)
        ? { ...x, status: "cancelled" }
        : x,
    );
    this.publish();
  }
  enqueue(side: Side, entries: FileEntry[], destination: string) {
    this.items.push(
      ...entries.map((entry): Transfer => {
        const id = crypto.randomUUID();
        return {
          id,
          request: {
            id,
            side,
            source: entry.path,
            destination,
            conflict: "ask",
          },
          status: "queued",
          bytes: 0,
          current: entry.path,
          error: null,
        };
      }),
    );
    this.publish();
    this.pump();
  }
  progress(progress: TransferProgress) {
    if (this.active !== progress.id) return;
    this.items = transferProgress(this.items, progress);
    if (progress.status !== "running") this.active = null;
    this.publish();
    this.pump();
  }
  resolve(id: string, conflict: Conflict) {
    this.items = this.items.map((x) =>
      x.id === id && ["conflict", "failed"].includes(x.status)
        ? {
            ...x,
            status: "queued",
            bytes: 0,
            error: null,
            request: { ...x.request, conflict },
          }
        : x,
    );
    this.publish();
    this.pump();
  }
  async cancel(id: string) {
    if (this.active === id) {
      await this.stop(id);
      return;
    }
    this.items = this.items.map((x) =>
      x.id === id && ["queued", "conflict"].includes(x.status)
        ? { ...x, status: "cancelled" }
        : x,
    );
    this.publish();
    this.pump();
  }
  clear() {
    this.items = this.items.filter((x) =>
      ["queued", "running", "conflict"].includes(x.status),
    );
    this.publish();
  }
}
