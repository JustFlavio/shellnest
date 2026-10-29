import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { muted, shortcutList } from "@/lib/editor-ui";
import {
  SHORTCUTS,
  comboFromEvent,
  findConflict,
  format,
  reservedReason,
  type Binding,
  type Combo,
} from "./shortcuts.ts";

type Overrides = Record<string, Combo[]>;

const same = (a: Combo[], b: Combo[], mac: boolean) =>
  a.map((c) => format(c, mac)).join() === b.map((c) => format(c, mac)).join();

export function ShortcutsEditor({
  bindings,
  overrides,
  mac,
  onChange,
  onResetAll,
}: {
  bindings: Binding[];
  overrides: Overrides;
  mac: boolean;
  onChange: (next: Overrides) => void;
  onResetAll: () => void;
}) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // A combo already taken by another action, waiting for the user to confirm the move.
  const [clash, setClash] = useState<{
    id: string;
    combo: Combo;
    with: Binding;
  } | null>(null);
  const defaults = (id: string) => SHORTCUTS.find((s) => s.id === id)!.combos;

  const assign = (next: Overrides, id: string, combos: Combo[]) => {
    const out = { ...next };
    if (same(combos, defaults(id), mac)) delete out[id];
    else out[id] = combos;
    return out;
  };

  useEffect(() => {
    if (!capturing) return;
    const id = capturing;
    const listener = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setCapturing(null);
      if (e.key === "Backspace" || e.key === "Delete") {
        setCapturing(null);
        setMessage("");
        return onChange(assign(overrides, id, []));
      }
      const combo = comboFromEvent(e, mac, id);
      if (!combo) {
        if (!["Shift", "Control", "Alt", "Meta"].includes(e.key))
          setMessage(
            t("settings.shortcutsEditor.atLeastOneModifier").replace(
              /⌘, ⌃ o ⌥/,
              mac ? "⌘, ⌃ o ⌥" : t("settings.shortcutsEditor.ctrlOrAlt"),
            ),
          );
        return;
      }
      const reserved = reservedReason(combo, mac);
      if (reserved) return setMessage(`${format(combo, mac)} ${reserved}.`);
      const other = findConflict(bindings, id, combo, mac);
      if (other) {
        setCapturing(null);
        setMessage("");
        return setClash({ id, combo, with: other });
      }
      setCapturing(null);
      setMessage("");
      onChange(assign(overrides, id, [combo]));
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  });

  const confirmClash = () => {
    if (!clash) return;
    const stolen = clash.with.combos.filter(
      (c) => format(c, mac) !== format(clash.combo, mac),
    );
    onChange(
      assign(assign(overrides, clash.with.id, stolen), clash.id, [clash.combo]),
    );
    setClash(null);
  };

  return (
    <>
      <p className={muted}>
        {t("settings.shortcutsEditor.escCancels")}
        {!mac && t("settings.shortcutsEditor.combinationsWithALetter")}
      </p>
      {(message || clash) && (
        <p role="alert" className="text-destructive">
          {clash
            ? t("settings.shortcutsEditor.alreadyUsedBy", {
                combo: format(clash.combo, mac),
                other: clash.with.label,
              })
            : message}
          {clash && (
            <>
              {" "}
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={confirmClash}
              >
                {t("settings.shortcutsEditor.reassign")}
              </Button>{" "}
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => setClash(null)}
              >
                {t("vault.deleteVaultDialog.cancel")}
              </Button>
            </>
          )}
        </p>
      )}
      <dl className={shortcutList}>
        {bindings.map((s) => {
          const changed = !same(s.combos, defaults(s.id), mac);
          return (
            <div key={s.id}>
              <dt>{s.label}</dt>
              <dd className="flex items-center gap-[6px]">
                {capturing === s.id ? (
                  <kbd>{t("settings.shortcutsEditor.pressTheCombination")}</kbd>
                ) : s.combos.length ? (
                  <kbd>{s.combos.map((c) => format(c, mac)).join(" / ")}</kbd>
                ) : (
                  <span className="text-muted-foreground">
                    {t("settings.shortcutsEditor.none")}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={t("settings.shortcutsEditor.editLabel", {
                    label: s.label,
                  })}
                  onClick={() => {
                    setClash(null);
                    setMessage("");
                    setCapturing(s.id);
                  }}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={t("settings.shortcutsEditor.restoreLabel", {
                    label: s.label,
                  })}
                  disabled={!changed}
                  className={changed ? "" : "invisible"}
                  onClick={() => {
                    setClash(null);
                    onChange(assign(overrides, s.id, defaults(s.id)));
                  }}
                >
                  <RotateCcw size={14} />
                </Button>
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          type="button"
          disabled={!Object.keys(overrides).length}
          onClick={onResetAll}
        >
          {t("settings.shortcutsEditor.restoreAll")}
        </Button>
      </div>
    </>
  );
}
