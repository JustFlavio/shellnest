import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { help } from "@/lib/editor-ui";
import type { Challenge } from "@/lib/types";

/** The server's own questions (a one-time code, a password…): answered here, sent once, then cleared. */
export function PromptsStep({
  challenge,
  onSubmit,
  onCancel,
}: {
  challenge: Challenge;
  onSubmit: (answers: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState(() => challenge.prompts.map(() => ""));
  const field = useRef<HTMLInputElement>(null);
  // After a frame, as for the password step; again for every new round.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const name = challenge.name.trim();
  const instructions = challenge.instructions.trim();
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles up from the form fields
    <form
      className="mt-[10px] rounded-[10px] border border-border bg-card p-[14px]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
        setValues(values.map(() => ""));
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <p className={help + " mt-0"}>
        {challenge.refused
          ? t("terminal.promptsStep.notAccepted")
          : t("terminal.promptsStep.serverAsks")}
      </p>
      {name && <p className="mt-[8px] text-[13px] font-medium">{name}</p>}
      {instructions && (
        <p className={help + " mt-[4px] whitespace-pre-wrap"}>{instructions}</p>
      )}
      {challenge.prompts.map((prompt, i) => {
        const props = {
          ref: i === 0 ? field : undefined,
          autoComplete: "off",
          value: values[i],
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setValues(values.map((v, j) => (j === i ? e.target.value : v))),
        };
        return (
          // Server text: the prompt may be anything, so it is shown as given.
          <label key={i} className="mt-[10px] block text-[12px]">
            {prompt.text.trim() || t("terminal.promptsStep.answer")}
            {prompt.echo ? <Input {...props} /> : <PasswordInput {...props} />}
          </label>
        );
      })}
      <div className="mt-[12px] flex flex-wrap justify-end gap-[8px]">
        <Button variant="ghost" type="button" onClick={onCancel}>
          {t("vault.deleteVaultDialog.cancel")}
        </Button>
        <Button type="submit">
          {challenge.refused
            ? t("vault.useVaultSync.retry")
            : t("terminal.passwordStep.signIn")}
        </Button>
      </div>
    </form>
  );
}
