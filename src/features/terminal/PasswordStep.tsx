import { useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { help } from "@/lib/editor-ui";

/** The server asked for a password: typed here, sent once, and gone from the page right away. */
export function PasswordStep({
  refused,
  onSubmit,
  onCancel,
}: {
  refused: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const field = useRef<HTMLInputElement>(null);
  // After a frame, as for the fingerprint card; again for every new question.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles up from the form fields
    <form
      className="mt-[10px] rounded-[10px] border border-border bg-card p-[14px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        onSubmit(value);
        setValue("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <p className={help + " mt-0"}>
        {refused
          ? "Password non accettata."
          : "Chiave rifiutata dal server: serve la password."}
      </p>
      <label className="mt-[10px] block text-[12px]">
        Password
        <PasswordInput
          ref={field}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="mt-[12px] flex flex-wrap justify-end gap-[8px]">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={!value}>
          {refused ? "Riprova" : "Accedi"}
        </Button>
      </div>
    </form>
  );
}
