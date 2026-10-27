import type { Ref } from "react";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { help, muted } from "@/lib/editor-ui";
import type { Identity } from "@/lib/types";
import type { ConnectionTarget } from "./connection-target.ts";

export function QuickConnectForm({
  target,
  identities,
  identityId,
  canConnect,
  selectRef,
  onIdentityChange,
  onSubmit,
}: {
  target: ConnectionTarget;
  identities: Identity[];
  identityId: string;
  canConnect: boolean;
  selectRef: Ref<HTMLButtonElement>;
  onIdentityChange: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-[18px] rounded-[9px] border border-input bg-card p-[18px] [&_h2]:mb-[9px]"
      onSubmit={(event) => {
        event.preventDefault();
        if (canConnect) onSubmit();
      }}
    >
      <h2>Connessione rapida</h2>
      <p className={muted}>
        <code>
          {target.username ? `${target.username}@` : ""}
          {target.address.includes(":")
            ? `[${target.address}]`
            : target.address}
          :{target.port}
        </code>
      </p>
      <div className="flex items-end gap-[12px] [&>button]:h-[36px] [&_label]:mb-0 [&_label]:min-w-0 [&_label]:flex-1">
        <label>
          Identità
          <SelectField
            ref={selectRef}
            aria-label="Identità per connessione rapida"
            required
            value={identityId}
            onValueChange={onIdentityChange}
            placeholder="Seleziona un’identità"
            options={identities.map((identity) => ({
              value: identity.id,
              label: identity.name + " — " + identity.username,
            }))}
          />
        </label>
        <Button variant="default" type="submit" disabled={!canConnect}>
          Connetti
        </Button>
      </div>
      <p className={help}>
        Usa le credenziali dell’identità scelta senza salvare un host.
        {target.username
          ? " L’utente indicato vale solo per questa connessione."
          : ""}
      </p>
    </form>
  );
}
