import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "@/lib/useLatest";
import type { Group, Host, HostDraft, Identity } from "@/lib/types";
import { hostDraftIsDirty, hostDraftIsValid } from "./host-draft";

export function useHostAutosave(
  draft: HostDraft | null,
  stored: Host | undefined,
  identities: Identity[],
  groups: Group[],
  vaultId: string,
  paused: boolean,
  persist: (draft: HostDraft) => Promise<Host>,
) {
  const latest = useLatest({
    draft,
    stored,
    identities,
    groups,
    vaultId,
    persist,
  });
  const acknowledged = useRef<HostDraft | null>(null);
  const saved = useRef<Host | null>(null);
  const failed = useRef<HostDraft | null>(null);
  const pending = useRef<Promise<Host> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    acknowledged.current = null;
    saved.current = null;
    failed.current = null;
    setError("");
  }, [draft?.id, vaultId]);

  const flush = useCallback(
    async function saveLatest(): Promise<Host | null> {
      clearTimeout(timer.current);
      if (pending.current) {
        await pending.current;
        return saveLatest();
      }
      const { draft, stored, identities, groups, vaultId, persist } =
        latest.current;
      if (!draft || !hostDraftIsValid(draft, identities, stored, groups))
        return null;
      if (draft === acknowledged.current) return saved.current;
      if (!hostDraftIsDirty(draft, stored)) return stored ?? null;
      setSaving(true);
      setError("");
      const request = Promise.resolve().then(() => persist(draft));
      pending.current = request;
      try {
        const result = await request;
        if (
          latest.current.draft?.id === draft.id &&
          latest.current.vaultId === vaultId
        ) {
          acknowledged.current = draft;
          saved.current = result;
          failed.current = null;
        }
        return result;
      } catch (e) {
        if (
          latest.current.draft?.id === draft.id &&
          latest.current.vaultId === vaultId
        ) {
          failed.current = draft;
          setError(String(e));
        }
        throw e;
      } finally {
        pending.current = null;
        setSaving(false);
      }
    },
    [latest],
  );
  const dirty =
    !!draft &&
    draft !== acknowledged.current &&
    hostDraftIsDirty(draft, stored);
  useEffect(() => {
    if (
      !draft ||
      paused ||
      saving ||
      !dirty ||
      failed.current === draft ||
      !hostDraftIsValid(draft, identities, stored, groups)
    )
      return;
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 650);
    return () => clearTimeout(timer.current);
  }, [
    draft,
    stored,
    identities,
    groups,
    vaultId,
    paused,
    saving,
    dirty,
    flush,
  ]);
  return {
    flush,
    dirty,
    error,
    status: saving
      ? "saving"
      : error && failed.current === draft
        ? "error"
        : dirty
          ? "editing"
          : stored
            ? "saved"
            : "idle",
  } as const;
}
