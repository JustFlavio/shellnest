import { SelectField } from "./SelectField";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { useMemo, useRef, useState } from "react";
import { Clock3, Search, TerminalSquare, ArrowUpRight } from "lucide-react";
import type { Host, Identity } from "./types";
import { parseConnectionTarget } from "./connection-target.mjs";
import type { ConnectionTarget } from "./connection-target.mjs";
import { OsIcon } from "./OsIcon";

type RecentHost = Host & {
  lastConnectedAt?: number | null;
  os?: string | null;
};
export type QuickConnection = ConnectionTarget & { identityId: string };
type LauncherTab = { id: string; title: string; subtitle?: string };
export type ConnectionLauncherProps = {
  hosts: RecentHost[];
  identities: Identity[];
  tabs: LauncherTab[];
  onConnect: (host: Host) => void;
  onActivateTab: (id: string) => void;
  onLocalTerminal: () => void;
  onQuickConnect: (target: QuickConnection) => void;
  preview: boolean;
  busy: boolean;
};

export function ConnectionLauncher({
  hosts,
  identities,
  tabs,
  onConnect,
  onActivateTab,
  onLocalTerminal,
  onQuickConnect,
  preview,
  busy,
}: ConnectionLauncherProps) {
  const [query, setQuery] = useState("");
  const identitySelect = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState(0);
  const [identityId, setIdentityId] = useState(
    identities.length === 1 ? identities[0].id : "",
  );
  const text = query.trim().toLocaleLowerCase();
  const recent = useMemo(
    () =>
      hosts
        .filter((host) => (host.lastConnectedAt ?? 0) > 0)
        .sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0))
        .slice(0, 12),
    [hosts],
  );
  const matchingTabs = text
    ? tabs.filter((tab) =>
        `${tab.title} ${tab.subtitle ?? ""}`.toLocaleLowerCase().includes(text),
      )
    : [];
  const matchingHosts = text
    ? hosts.filter((host) =>
        `${host.name} ${host.address} ${host.group} ${identities.find((identity) => identity.id === host.identityId)?.username ?? host.username ?? ""}`
          .toLocaleLowerCase()
          .includes(text),
      )
    : recent.length
      ? recent
      : hosts.slice(0, 12);
  const target = parseConnectionTarget(query);
  const results = [
    ...matchingTabs.map((tab) => ({
      key: `tab-${tab.id}`,
      title: tab.title,
      detail: tab.subtitle ?? "Sessione aperta",
      kind: "tab" as const,
      timestamp: undefined,
      os: undefined,
      activate: () => onActivateTab(tab.id),
    })),
    ...matchingHosts.map((host) => ({
      key: `host-${host.id}`,
      title: host.name,
      detail: `${identities.find((identity) => identity.id === host.identityId)?.username ?? host.username ?? "?"}@${host.address}:${host.port}${host.group ? ` · ${host.group}` : ""}`,
      kind: "host" as const,
      timestamp: host.lastConnectedAt,
      os: host.os,
      activate: () => onConnect(host),
    })),
  ];
  const selected = Math.min(selection, Math.max(0, results.length - 1));
  return (
    <section className="launcher" aria-label="Apri connessione">
      <div className="launcher-heading">
        <div>
          <h1>Nuova connessione</h1>
          <p className="muted">
            Cerca un host, passa a una sessione aperta o inserisci un indirizzo
            SSH.
          </p>
        </div>
        <Button
          variant="ghost"
          type="button"
          className="launcher-local"
          disabled={busy || preview}
          onClick={onLocalTerminal}
        >
          <TerminalSquare size={16} />
          Terminale locale
        </Button>
      </div>
      <div className="launcher-search">
        <Search size={18} />
        <Input
          autoFocus
          aria-label="Cerca host o schede"
          placeholder="Cerca host o schede · ssh utente@host -p 22"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelection(0);
          }}
          aria-controls="connection-results"
          aria-activedescendant={
            results.length ? `connection-${results[selected].key}` : undefined
          }
          role="combobox"
          aria-expanded={results.length > 0}
          aria-autocomplete="list"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setSelection((selected + 1) % results.length);
            }
            if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setSelection((selected + results.length - 1) % results.length);
            }
            if (event.key === "Enter" && results.length && !busy) {
              event.preventDefault();
              results[selected].activate();
            }
            if (
              event.key === "Enter" &&
              !results.length &&
              target &&
              !busy &&
              !preview
            ) {
              event.preventDefault();
              if (identities.some((identity) => identity.id === identityId))
                onQuickConnect({ ...target, identityId });
              else identitySelect.current?.focus();
            }
            if (event.key === "Escape") {
              setQuery("");
              setSelection(0);
            }
          }}
        />
        <kbd>Ctrl/Cmd K</kbd>
      </div>
      <div className="launcher-results">
        <div className="launcher-section-title">
          <Clock3 size={14} />
          <h2>
            {text
              ? "Risultati"
              : recent.length
                ? "Connessioni recenti"
                : "Host salvati"}
          </h2>
          <span>{results.length}</span>
        </div>
        <div
          id="connection-results"
          role="listbox"
          aria-label={text ? "Risultati ricerca" : "Connessioni disponibili"}
        >
          {results.map((result, index) => (
            <Button
              variant="ghost"
              type="button"
              key={result.key}
              id={`connection-${result.key}`}
              role="option"
              aria-selected={selected === index}
              className={`launcher-result${selected === index ? " selected" : ""}`}
              disabled={busy}
              onMouseEnter={() => setSelection(index)}
              onClick={result.activate}
            >
              <OsIcon os={result.os} />
              <span className="launcher-result-name">
                {result.title}
                <small>{result.detail}</small>
              </span>
              <span className="launcher-result-kind">
                {result.kind === "tab"
                  ? "Scheda aperta"
                  : !text &&
                      result.timestamp &&
                      Number.isFinite(new Date(result.timestamp).getTime())
                    ? new Date(result.timestamp).toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "SSH"}
              </span>
              <ArrowUpRight size={14} />
            </Button>
          ))}
        </div>
        {!results.length && (
          <p className="launcher-empty">
            {text
              ? "Nessun host o scheda corrisponde alla ricerca."
              : "Le connessioni recenti compariranno dopo il primo accesso riuscito."}
          </p>
        )}
      </div>
      {target && (
        <form
          className="launcher-quick"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              identities.some((identity) => identity.id === identityId) &&
              !busy &&
              !preview
            )
              onQuickConnect({ ...target, identityId });
          }}
        >
          <h2>Connessione rapida</h2>
          <p className="muted">
            <code>
              {target.username ? `${target.username}@` : ""}
              {target.address.includes(":")
                ? `[${target.address}]`
                : target.address}
              :{target.port}
            </code>
          </p>
          <div className="launcher-quick-fields">
            <label>
              Identità
              <SelectField
                ref={identitySelect}
                aria-label="Identità per connessione rapida"
                required
                value={identityId}
                onValueChange={setIdentityId}
                placeholder="Seleziona un’identità"
                options={identities.map((identity) => ({
                  value: identity.id,
                  label: identity.name + " — " + identity.username,
                }))}
              />
            </label>
            <Button
              variant="default"
              type="submit"
              className="primary"
              disabled={
                busy ||
                preview ||
                !identities.some((identity) => identity.id === identityId)
              }
            >
              Connetti
            </Button>
          </div>
          <p className="help">
            Usa le credenziali dell’identità scelta senza salvare un host.
            {target.username
              ? " L’utente indicato vale solo per questa connessione."
              : ""}
          </p>
        </form>
      )}
      {preview && (
        <p className="launcher-preview help">
          Anteprima: connessioni SSH e terminale locale sono disponibili
          nell’app desktop.
        </p>
      )}
    </section>
  );
}
