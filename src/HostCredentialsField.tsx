import { Combobox } from "@base-ui/react/combobox";
import { UserRound, ContactRound, X } from "lucide-react";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import type { HostDraft, Identity } from "./types";
import { useState } from "react";

export function HostCredentialsField({
  value,
  identities,
  onChange,
  onNewIdentity,
}: {
  value: HostDraft;
  identities: Identity[];
  onChange: (value: HostDraft) => void;
  onNewIdentity: () => void;
}) {
  const selected = identities.find((i) => i.id === value.identityId) ?? null;
  const [open, setOpen] = useState(false);
  const credentials = value.credentials ?? {
    username: value.username ?? "",
    password: "",
  };
  return (
    <>
      <Combobox.Root<Identity>
        items={identities}
        open={open && identities.length > 0}
        onOpenChange={(open) => setOpen(open)}
        value={selected}
        inputValue={selected?.username ?? credentials.username}
        itemToStringLabel={(identity) => identity.username}
        isItemEqualToValue={(a, b) => a.id === b.id}
        filter={null}
        openOnInputClick
        onInputValueChange={(username, details) => {
          if (
            details.reason === "input-change" ||
            details.reason === "input-clear"
          ) {
            onChange({
              ...value,
              identityId: "",
              credentials: { ...credentials, username },
            });
          }
        }}
        onValueChange={(identity, details) => {
          if (identity && details.reason === "item-press")
            onChange({ ...value, identityId: identity.id });
        }}
      >
        <div className="sheet-control sheet-field">
          <UserRound className="field-icon" aria-hidden="true" />
          <Combobox.Input
            render={<Input />}
            aria-label="Utente SSH"
            autoComplete="off"
            placeholder="Utente SSH"
            required
          />
        </div>
        {identities.length > 0 && (
          <Combobox.Portal>
            <Combobox.Positioner
              sideOffset={6}
              align="start"
              className="identity-suggestions-positioner"
            >
              <Combobox.Popup className="identity-suggestions">
                <Combobox.List>
                  {(identity: Identity) => (
                    <Combobox.Item
                      key={identity.id}
                      value={identity}
                      className="identity-suggestion"
                    >
                      <ContactRound aria-hidden="true" />
                      <span>
                        <strong>{identity.name}</strong>
                        <small>
                          {identity.username} ·{" "}
                          {identity.auth === "key" ? "Chiave SSH" : "Password"}
                        </small>
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
                <Button
                  variant="ghost"
                  type="button"
                  className="create-shared-identity"
                  onClick={onNewIdentity}
                >
                  Crea identità condivisa
                </Button>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        )}
      </Combobox.Root>
      {selected && (
        <div className="selected-host-identity">
          <ContactRound aria-hidden="true" />
          <span>
            Identità: <strong>{selected.name}</strong>
          </span>
          <Button
            variant="ghost"
            type="button"
            size="icon-xs"
            aria-label="Usa credenziali proprie dell’host"
            onClick={() => onChange({ ...value, identityId: "" })}
          >
            <X />
          </Button>
        </div>
      )}
    </>
  );
}
