import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { help } from "@/lib/editor-ui";
import type { Identity } from "@/lib/types";
import { QuickActions } from "./QuickActions";
import { pickableIdentities, quickLogin } from "./quick-setup.ts";
import type { QuickSetupState } from "./useQuickSetup";

/** First question of a quick connection: the user, or a saved identity that brings its own. */
export function QuickUserStep({
  state: { setup, patch, setStage },
  identities,
  busy,
  onSubmit,
  onCancel,
}: {
  state: QuickSetupState;
  identities: Identity[];
  busy: boolean;
  onSubmit: (save: boolean) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const offered = pickableIdentities(identities, query);
  const anyIdentity = pickableIdentities(identities, "").length > 0;
  const chosen = identities.find((i) => i.id === setup.identityId);
  return (
    <form
      className="mt-[10px] rounded-[10px] border border-border bg-card p-[14px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (setup.identityId) onSubmit(false);
        else if (quickLogin(setup)) setStage("method");
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <label className="block text-[12px]">
        Utente
        <Input
          ref={field}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={setup.username}
          disabled={!!chosen}
          onChange={(e) => patch({ username: e.target.value.trim() })}
        />
      </label>
      {anyIdentity && (
        <div className="mt-[12px]">
          <p className={help + " mt-0 mb-[6px]"}>
            Oppure scegli un’identità salvata, con le sue credenziali.
          </p>
          <Input
            type="search"
            aria-label="Cerca identità"
            placeholder="Cerca identità"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul
            aria-label="Identità salvate"
            className="m-0 mt-[6px] max-h-[140px] list-none overflow-auto p-0"
          >
            {offered.map((identity) => (
              <li key={identity.id}>
                <button
                  type="button"
                  aria-pressed={identity.id === setup.identityId}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[8px] border-0 bg-transparent px-[10px] py-[6px] text-left text-[13px] text-foreground hover:bg-muted",
                    identity.id === setup.identityId &&
                      "bg-muted outline-1 outline-primary",
                  )}
                  onClick={() =>
                    patch(
                      identity.id === setup.identityId
                        ? { identityId: "" }
                        : {
                            identityId: identity.id,
                            username: identity.username,
                          },
                    )
                  }
                >
                  <span>{identity.name}</span>
                  <span className="text-muted-foreground">
                    {identity.username}
                  </span>
                </button>
              </li>
            ))}
            {!offered.length && (
              <li className={help + " m-0 px-[10px]"}>
                Nessuna identità corrisponde.
              </li>
            )}
          </ul>
        </div>
      )}
      {setup.identityId ? (
        <QuickActions
          setup={setup}
          busy={busy}
          onName={(name) => patch({ name })}
          onSubmit={onSubmit}
        />
      ) : (
        <div className="mt-[12px] flex justify-end gap-[8px]">
          <Button type="submit" disabled={!quickLogin(setup)}>
            Avanti
          </Button>
        </div>
      )}
    </form>
  );
}
