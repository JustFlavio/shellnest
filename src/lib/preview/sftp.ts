// In-memory file browser: synthetic metadata only, no access to the device or network.
import type {
  Directory,
  FileEntry,
  Mutation,
  SftpEvent,
  Side,
  TransferRequest,
} from "../../features/sftp/types.ts";

type Output = { onmessage: (event: SftpEvent) => void };
type PreviewSession = {
  output: Output;
  files: Record<Side, Map<string, FileEntry>>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
};
const fail = (code: string): never => {
  throw { code: `sftp.${code}` };
};
function name(value: string) {
  if (!value || value === "." || value === ".." || /[/\\\0]/.test(value))
    fail("InvalidPath");
}
function join(parent: string, child: string) {
  name(child);
  return `${parent === "/" ? "" : parent}/${child}`;
}
function parent(path: string) {
  return path === "/" ? null : path.slice(0, path.lastIndexOf("/")) || "/";
}
function entries(side: Side) {
  const home = side === "local" ? "/home/demo" : "/root";
  const map = new Map<string, FileEntry>();
  for (const [path, kind, size] of [
    ["/", "directory", null],
    ...(side === "local" ? [["/home", "directory", null]] : []),
    [home, "directory", null],
    [`${home}/projects`, "directory", null],
    [`${home}/notes.txt`, "file", 2048],
    [`${home}/.config`, "directory", null],
    [`${home}/projects/readme.md`, "file", 4096],
  ] as [string, FileEntry["kind"], number | null][]) {
    const n = path.split("/").pop() || "/";
    map.set(path, {
      name: n,
      path,
      kind,
      size,
      modified: 1793304000,
      hidden: n.startsWith("."),
    });
  }
  return map;
}
export function createPreviewSftp() {
  const sessions = new Map<string, PreviewSession>();
  const filesByHost = new Map<string, Map<string, FileEntry>>();
  const local = entries("local");
  const close = (id: string) => {
    const session = sessions.get(id);
    if (session) {
      session.timers.forEach(clearTimeout);
      session.output.onmessage({ type: "closed" });
      sessions.delete(id);
    }
  };
  return {
    closeAll: () => [...sessions.keys()].forEach(close),
    invoke: (command: string, args: Record<string, unknown>): unknown => {
      const id = String(args.sessionId);
      if (command === "sftp_connect") {
        const host = String(args.id ?? JSON.stringify(args.target));
        if (!filesByHost.has(host)) filesByHost.set(host, entries("remote"));
        const session: PreviewSession = {
          output: args.output as Output,
          files: { local, remote: filesByHost.get(host)! },
          timers: new Map(),
        };
        sessions.set(id, session);
        queueMicrotask(() => {
          if (sessions.get(id) === session)
            session.output.onmessage({ type: "ready" });
        });
        return;
      }
      if (command === "sftp_close") {
        close(id);
        return;
      }
      const session = sessions.get(id);
      if (!session) fail("NotConnected");
      const current = session!;
      const side: Side = args.side === "remote" ? "remote" : "local";
      const files = current.files[side];
      if (command === "sftp_list") {
        const path = String(
          args.path || (side === "local" ? "/home/demo" : "/root"),
        );
        if (files.get(path)?.kind !== "directory") fail("InvalidPath");
        return {
          path,
          parent: parent(path),
          roots: ["/"],
          entries: [...files.values()]
            .filter((e) => e.path !== path && parent(e.path) === path)
            .map((e) => ({ ...e })),
        } satisfies Directory;
      }
      if (command === "sftp_mutate") {
        const mutation = args.mutation as Mutation;
        if (mutation.type === "mkdir") {
          const path = join(mutation.parent, mutation.name);
          if (files.has(path)) fail("Exists");
          files.set(path, {
            path,
            name: mutation.name,
            kind: "directory",
            size: null,
            modified: Date.now() / 1000,
            hidden: mutation.name.startsWith("."),
          });
        } else if (mutation.type === "delete") {
          for (const path of mutation.paths) {
            if (path === "/") fail("InvalidPath");
            for (const key of files.keys())
              if (key === path || key.startsWith(`${path}/`)) files.delete(key);
          }
        } else {
          const source = files.get(mutation.path);
          if (!source || !parent(source.path)) fail("InvalidPath");
          const destination = join(parent(mutation.path)!, mutation.name);
          if (files.has(destination)) fail("Exists");
          const moved = [...files.values()].filter(
            (e) =>
              e.path === mutation.path ||
              e.path.startsWith(`${mutation.path}/`),
          );
          for (const entry of moved) {
            files.delete(entry.path);
            const path = destination + entry.path.slice(mutation.path.length);
            files.set(path, { ...entry, path, name: path.split("/").pop()! });
          }
        }
        return;
      }
      if (command === "sftp_cancel") {
        const key = String(args.id),
          timer = current.timers.get(key);
        if (timer) {
          clearTimeout(timer);
          current.timers.delete(key);
          current.output.onmessage({
            type: "transfer",
            data: {
              id: key,
              status: "cancelled",
              bytes: 0,
              current: "",
              error: null,
            },
          });
        }
        return;
      }
      if (command === "sftp_transfer") {
        const request = args.request as TransferRequest;
        if (current.timers.size) fail("TransferBusy");
        const source = current.files[request.side],
          target = current.files[request.side === "local" ? "remote" : "local"];
        const entry = source.get(request.source);
        if (!entry || target.get(request.destination)?.kind !== "directory")
          fail("InvalidPath");
        const report = (
          status: "running" | "completed" | "conflict" | "failed",
          code?: string,
        ) =>
          current.output.onmessage({
            type: "transfer",
            data: {
              id: request.id,
              status,
              current: request.source,
              bytes: status === "completed" ? (entry!.size ?? 0) : 0,
              error: code ? { code: `sftp.${code}` } : null,
            },
          });
        report("running");
        const timer = setTimeout(() => {
          current.timers.delete(request.id);
          let destination = join(request.destination, entry!.name);
          const existing = target.get(destination);
          if (existing && request.conflict === "ask") {
            report("conflict", "Exists");
            return;
          }
          if (existing && request.conflict === "skip") {
            report("completed");
            return;
          }
          if (
            existing &&
            request.conflict === "replace" &&
            existing.kind !== entry!.kind
          ) {
            report("failed", "TypeConflict");
            return;
          }
          if (existing && request.conflict === "keepBoth") {
            let i = 0;
            const dot = entry!.name.lastIndexOf("."),
              stem = dot > 0 ? entry!.name.slice(0, dot) : entry!.name,
              ext = dot > 0 ? entry!.name.slice(dot) : "";
            do {
              destination = join(request.destination, `${stem} (${++i})${ext}`);
            } while (target.has(destination));
          }
          for (const item of source.values())
            if (
              item.path === request.source ||
              item.path.startsWith(`${request.source}/`)
            ) {
              const path = destination + item.path.slice(request.source.length);
              const collision = target.get(path);
              if (
                collision &&
                path !== destination &&
                request.conflict === "ask"
              ) {
                report("conflict", "Exists");
                return;
              }
              if (collision && request.conflict === "skip") continue;
              target.set(path, { ...item, path, name: path.split("/").pop()! });
            }
          report("completed");
        }, 350);
        current.timers.set(request.id, timer);
        return;
      }
      if (command === "sftp_password") return;
      fail("InvalidPath");
    },
  };
}
