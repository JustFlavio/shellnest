import { Combobox } from "@base-ui/react/combobox";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SshKey } from "@/lib/types";
import {
  fieldIcon,
  sheetField,
  suggestion,
  suggestions,
  suggestionsPositioner,
} from "@/lib/editor-ui";

export function HostKeyField({
  value,
  keys,
  onChange,
  onNewKey,
}: {
  value: string;
  keys: SshKey[];
  onChange: (keyId: string) => void;
  onNewKey?: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = keys.find((key) => key.id === value) ?? null;
  const items = keys.filter((key) =>
    key.name.toLocaleLowerCase().includes((query ?? "").toLocaleLowerCase()),
  );
  return (
    <div className={sheetField}>
      <Combobox.Root<SshKey>
        items={items}
        open={open}
        value={selected}
        inputValue={query ?? selected?.name ?? ""}
        itemToStringLabel={(key) => key.name}
        isItemEqualToValue={(a, b) => a.id === b.id}
        filter={null}
        autoHighlight
        openOnInputClick
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) setQuery(null);
        }}
        onInputValueChange={(text, details) => {
          if (
            details.reason === "input-change" ||
            details.reason === "input-clear"
          )
            setQuery(text);
        }}
        onValueChange={(key) => {
          if (key) onChange(key.id);
          setQuery(null);
          setOpen(false);
        }}
      >
        <div className="relative [&_[data-slot=input]]:pl-[38px]">
          <KeyRound className={fieldIcon} aria-hidden="true" />
          <Combobox.Input
            render={<Input />}
            aria-label={t("hosts.hostAccessSection.key")}
            placeholder={t("hosts.hostAccessSection.chooseKey")}
            autoComplete="off"
            onFocus={() => setOpen(true)}
          />
        </div>
        <Combobox.Portal>
          <Combobox.Positioner
            className={suggestionsPositioner}
            sideOffset={6}
            align="start"
          >
            <Combobox.Popup className={suggestions}>
              <Combobox.List>
                {(key: SshKey) => (
                  <Combobox.Item
                    key={key.id}
                    value={key}
                    className={suggestion}
                  >
                    <KeyRound aria-hidden="true" />
                    <span>{key.name}</span>
                  </Combobox.Item>
                )}
              </Combobox.List>
              {onNewKey && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={onNewKey}
                >
                  {t("hosts.hostAccessSection.importKey")}
                </Button>
              )}
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
