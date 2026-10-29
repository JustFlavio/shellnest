import { useTranslation } from "react-i18next";
import { Combobox } from "@base-ui/react/combobox";
import { UserRound, ContactRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HostDraft, Identity } from "@/lib/types";
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
  onChange,
  onNewIdentity,
}: {
  value: HostDraft;
  identities: Identity[];
  onChange: (value: HostDraft) => void;
  onNewIdentity: () => void;
}) {
  const { t } = useTranslation();
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
                            ? t("hosts.hostCredentialsField.sshKey")
                            : t("hosts.collectionTables.password")}
                        </small>
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
                <Button
                  variant="ghost"
                  type="button"
                  className="mt-[4px] w-full text-[12px] text-primary"
                  onClick={onNewIdentity}
                >
                  {t("hosts.hostCredentialsField.createSharedIdentity")}
                </Button>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        )}
      </Combobox.Root>
      {/* The suggestions popup only exists once there is an identity to pick. */}
      {identities.length === 0 && (
        <Button
          variant="ghost"
          type="button"
          className="w-full text-[12px] text-primary"
          onClick={onNewIdentity}
        >
          {t("hosts.hostCredentialsField.createSharedIdentity")}
        </Button>
      )}
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
