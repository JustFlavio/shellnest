import { PasswordInput } from "@/components/PasswordInput";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { help } from "@/lib/editor-ui";
import type { SshKey } from "@/lib/types";
import { QuickActions } from "./QuickActions";
import type { QuickSetupState } from "./useQuickSetup";

/** Second question of a quick connection, only without an identity: a password or a key from the vault. */
export function QuickMethodStep({
  state: { setup, patch, setStage },
  keys,
  busy,
  onSubmit,
  onCancel,
}: {
  state: QuickSetupState;
  keys: SshKey[];
  busy: boolean;
  onSubmit: (save: boolean) => void;
  onCancel: () => void;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles up from the form fields
    <form
      className="mt-[10px] rounded-[10px] border border-border bg-card p-[14px]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <fieldset className="m-0 flex gap-[16px] border-0 p-0">
        <legend className="mb-[6px] p-0 text-[12px]">Accedi con</legend>
        {(["password", "key"] as const).map((method) => (
          <label
            key={method}
            className="m-0! flex-row! items-center gap-[6px] text-[13px] text-foreground"
          >
            <input
              type="radio"
              className="m-0 accent-primary"
              name="quick-method"
              checked={setup.method === method}
              disabled={method === "key" && !keys.length}
              onChange={() => patch({ method })}
            />
            {method === "password" ? "Password" : "Chiave"}
          </label>
        ))}
      </fieldset>
      {setup.method === "password" ? (
        <label className="mt-[10px] block text-[12px]">
          Password
          <PasswordInput
            autoComplete="off"
            value={setup.password}
            onChange={(e) => patch({ password: e.target.value })}
          />
        </label>
      ) : (
        <label className="mt-[10px] block text-[12px]">
          Chiave
          <SelectField
            aria-label="Chiave dal portachiavi"
            value={setup.keyId}
            onValueChange={(keyId) => patch({ keyId })}
            placeholder="Seleziona una chiave"
            options={keys.map((key) => ({ value: key.id, label: key.name }))}
          />
        </label>
      )}
      {!keys.length && (
        <p className={help + " mb-0"}>Nessuna chiave nel portachiavi.</p>
      )}
      <QuickActions
        setup={setup}
        busy={busy}
        onName={(name) => patch({ name })}
        onSubmit={onSubmit}
      />
      <div className="mt-[8px]">
        <Button variant="ghost" type="button" onClick={() => setStage("user")}>
          Indietro
        </Button>
      </div>
    </form>
  );
}
