import { useEffect, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Button } from "./components/ui/button";
import { muted, shortcutList } from "./editor-ui";
import {
  SHORTCUTS,
  comboFromEvent,
  findConflict,
  format,
  reservedReason,
  type Binding,
  type Combo,
} from "./shortcuts.mjs";

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
            "Serve almeno un modificatore (⌘, ⌃ o ⌥) insieme al tasto.".replace(
              /⌘, ⌃ o ⌥/,
              mac ? "⌘, ⌃ o ⌥" : "Ctrl o Alt",
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
        Clicca la matita e premi la nuova combinazione. Esc annulla, Backspace
        disattiva la scorciatoia.
        {!mac &&
          " Le combinazioni con una lettera usano Ctrl+Maiusc per lasciare liberi i comandi del terminale."}
      </p>
      {(message || clash) && (
        <p role="alert" className="text-destructive">
          {clash
            ? `${format(clash.combo, mac)} è già usata da “${clash.with.label}”.`
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
                Riassegna
              </Button>{" "}
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => setClash(null)}
              >
                Annulla
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
                  <kbd>Premi la combinazione…</kbd>
                ) : s.combos.length ? (
                  <kbd>{s.combos.map((c) => format(c, mac)).join(" / ")}</kbd>
                ) : (
                  <span className="text-muted-foreground">Nessuna</span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={`Modifica “${s.label}”`}
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
                  aria-label={`Ripristina “${s.label}”`}
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
        <div>
          <dt>Connetti dalla scheda host</dt>
          <dd>
            <kbd>Invio</kbd>
          </dd>
        </div>
        <div>
          <dt>Seleziona host</dt>
          <dd>
            <kbd>Spazio / Ctrl/Cmd clic</kbd>
          </dd>
        </div>
        <div>
          <dt>Annulla selezione o chiudi pannello</dt>
          <dd>
            <kbd>Esc</kbd>
          </dd>
        </div>
      </dl>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          type="button"
          disabled={!Object.keys(overrides).length}
          onClick={onResetAll}
        >
          Ripristina tutte
        </Button>
      </div>
    </>
  );
}
