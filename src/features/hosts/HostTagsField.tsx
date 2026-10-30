import { Combobox } from "@base-ui/react/combobox";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  fieldIcon,
  sheetField,
  suggestion,
  suggestions as popup,
  suggestionsPositioner,
} from "@/lib/editor-ui";

export function HostTagsField({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const term = query.trim();
  const available = suggestions.filter(
    (tag) =>
      !value.some((selected) => selected.toLowerCase() === tag.toLowerCase()) &&
      tag.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
  );
  const exact = [...suggestions, ...value].some(
    (tag) => tag.toLocaleLowerCase() === term.toLocaleLowerCase(),
  );
  const create = !!term && !exact;
  const items = create ? [...available, term] : available;
  return (
    <div className={sheetField}>
      {value.length > 0 && (
        <div className="mb-[6px] flex flex-wrap gap-[6px]">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex max-w-full items-center gap-[4px] rounded-[6px] bg-accent pl-[8px] text-[12px] wrap-anywhere"
            >
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("hosts.hostTagsField.remove", { name: tag })}
                onClick={() => onChange(value.filter((item) => item !== tag))}
              >
                <X />
              </Button>
            </span>
          ))}
        </div>
      )}
      <Combobox.Root<string>
        items={items}
        open={open && items.length > 0}
        onOpenChange={setOpen}
        value={null}
        inputValue={query}
        filter={null}
        autoHighlight
        openOnInputClick
        onInputValueChange={(text, details) => {
          if (
            details.reason === "input-change" ||
            details.reason === "input-clear"
          )
            setQuery(text);
        }}
        onValueChange={(tag) => {
          if (tag && !value.includes(tag)) onChange([...value, tag]);
          setQuery("");
          setOpen(false);
        }}
      >
        <div className="relative [&_[data-slot=input]]:pl-[38px]">
          <Tag className={fieldIcon} aria-hidden="true" />
          <Combobox.Input
            render={<Input />}
            aria-label={t("hosts.hostTagsField.tags")}
            placeholder={t("hosts.hostTagsField.search")}
            maxLength={64}
            disabled={value.length >= 32}
            autoComplete="off"
            onFocus={() => setOpen(true)}
          />
        </div>
        <Combobox.Portal>
          <Combobox.Positioner
            sideOffset={6}
            align="start"
            className={suggestionsPositioner}
          >
            <Combobox.Popup className={popup}>
              <Combobox.List>
                {(tag: string) => (
                  <Combobox.Item key={tag} value={tag} className={suggestion}>
                    <Tag aria-hidden="true" />
                    <span>
                      {create && tag === term
                        ? t("hosts.hostTagsField.create", { name: tag })
                        : tag}
                    </span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
