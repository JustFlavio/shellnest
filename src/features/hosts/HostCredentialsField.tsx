import { useTranslation } from "react-i18next";
import { Combobox } from "@base-ui/react/combobox";
import { UserRound, ContactRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HostDraft, Identity, SshKey } from "@/lib/types";
import { useState } from "react";
import {
  fieldIcon,
  selectedHostIdentity,
  sheetField,
  suggestion,
  suggestions,
  suggestionsPositioner,
} from "@/lib/editor-ui";

export function HostCredentialsField({
  value,
  identities,
  keys = [],
  onChange,
}: {
  value: HostDraft;
  identities: Identity[];
  keys?: SshKey[];
  onChange: (value: HostDraft) => void;
}) {
  const { t } = useTranslation();
  const selected = identities.find((i) => i.id === value.identityId) ?? null;
  const [open, setOpen] = useState(false);
  const credentials = value.credentials ?? {
    username: value.username ?? "",
    password: "",
    keyId: value.keyId,
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
          if (details.reason === "input-change") {
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
        <div
          className={cn("relative [&_[data-slot=input]]:pl-[38px]", sheetField)}
        >
          <UserRound className={fieldIcon} aria-hidden="true" />
          <Combobox.Input
            render={<Input />}
            aria-label={t("hosts.collectionTables.sshUser")}
            autoComplete="off"
            placeholder={t("hosts.collectionTables.sshUser")}
            required
          />
        </div>
        {identities.length > 0 && (
          <Combobox.Portal>
            <Combobox.Positioner
              sideOffset={6}
              align="start"
              className={suggestionsPositioner}
            >
              <Combobox.Popup className={suggestions}>
                <Combobox.List>
                  {(identity: Identity) => (
                    <Combobox.Item
                      key={identity.id}
                      value={identity}
                      className={suggestion}
                    >
                      <ContactRound aria-hidden="true" />
                      <span>
                        <strong>{identity.name}</strong>
                        <small>
                          {identity.username} ·{" "}
                          {identity.auth === "key"
                            ? (keys.find((key) => key.id === identity.keyId)
                                ?.name ??
                              t("hosts.hostCredentialsField.sshKey"))
                            : t("hosts.collectionTables.password")}
                        </small>
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        )}
      </Combobox.Root>
      {selected && (
        <div className={selectedHostIdentity}>
          <ContactRound aria-hidden="true" />
          <span>
            {t("hosts.hostCredentialsField.identity")}{" "}
            <strong>{selected.name}</strong>
          </span>
          <Button
            variant="ghost"
            type="button"
            size="icon-xs"
            aria-label={t("hosts.hostCredentialsField.useTheHostS")}
            onClick={() => onChange({ ...value, identityId: "" })}
          >
            <X />
          </Button>
        </div>
      )}
    </>
  );
}
