import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "@/lib/useLatest";
import { describeError } from "@/lib/error-message";
import type { Directory, Mutation, SftpInvoke, Side } from "./types";

export function useFileBrowser(invoke: SftpInvoke, side: Side, ready: boolean) {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set<string>());
  const [history, setHistory] = useState<string[]>([]),
    [index, setIndex] = useState(-1);
  const generation = useRef(0);
  const navigate = useCallback(
    async (path: string, historyIndex?: number) => {
      const request = ++generation.current;
      setLoading(true);
      setError("");
      try {
        const next = await invoke<Directory>("sftp_list", { side, path });
        if (request !== generation.current) return;
        setDirectory(next);
        setSelected(new Set());
        if (historyIndex !== undefined) setIndex(historyIndex);
        else if (next.path !== history[index]) {
          setHistory((old) => [...old.slice(0, index + 1), next.path]);
          setIndex(index + 1);
        }
      } catch (e) {
        if (request === generation.current) setError(describeError(e));
      } finally {
        if (request === generation.current) setLoading(false);
      }
    },
    [invoke, side, history, index],
  );
  const initial = useLatest(navigate);
  useEffect(() => {
    if (ready) void initial.current("");
    const invalidate = () => {
      generation.current++;
    };
    return invalidate;
  }, [ready, initial]);
  const refresh = () => directory && navigate(directory.path, index);
  const mutate = async (mutation: Mutation) => {
    setLoading(true);
    setError("");
    try {
      await invoke("sftp_mutate", { side, mutation });
      await refresh();
      return true;
    } catch (e) {
      const message = describeError(e);
      await refresh();
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  };
  return {
    directory,
    loading,
    error,
    selected,
    setSelected,
    navigate,
    refresh,
    mutate,
    back:
      index > 0
        ? () => void navigate(history[index - 1], index - 1)
        : undefined,
    forward:
      index + 1 < history.length
        ? () => void navigate(history[index + 1], index + 1)
        : undefined,
  };
}
export type FileBrowser = ReturnType<typeof useFileBrowser>;
