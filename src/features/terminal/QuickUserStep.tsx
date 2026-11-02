import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stripWhitespace } from "@/lib/input-text";
import { help } from "@/lib/editor-ui";
import type { Identity } from "@/lib/types";
import { QuickActions } from "./QuickActions";
import { pickableIdentities, quickLogin } from "./quick-setup.ts";
import type { QuickSetupState } from "./useQuickSetup";
import { Toggle } from "@/components/ui/toggle";

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
  const { t } = useTranslation();
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
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles up from the form fields
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
        {t("terminal.quickUserStep.user")}
        <Input
          ref={field}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={setup.username}
          disabled={!!chosen}
          onChange={(e) => patch({ username: stripWhitespace(e.target.value) })}
        />
      </label>
      {anyIdentity && (
        <div className="mt-[12px]">
          <p className={help + " mt-0 mb-[6px]"}>
            {t("terminal.quickUserStep.orASavedIdentity")}
          </p>
          <Input
            type="search"
            aria-label={t("terminal.quickUserStep.searchIdentity")}
            placeholder={t("terminal.quickUserStep.searchIdentity")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul
            aria-label={t("terminal.quickUserStep.savedIdentities")}
            className="m-0 mt-[6px] max-h-[140px] list-none overflow-auto p-0"
          >
            {offered.map((identity) => (
              <li key={identity.id}>
                <Toggle
                  pressed={identity.id === setup.identityId}
                  className="h-auto w-full justify-between rounded-[8px] px-[10px] py-[6px] text-left text-[13px] font-normal text-foreground aria-pressed:outline-1 aria-pressed:outline-primary"
                  onPressedChange={() =>
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
                </Toggle>
              </li>
            ))}
            {!offered.length && (
              <li className={help + " m-0 px-[10px]"}>
                {t("terminal.quickUserStep.noMatchingIdentity")}
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
            {t("terminal.quickUserStep.next")}
          </Button>
        </div>
      )}
    </form>
  );
}
