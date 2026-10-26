import {
  AlertDialog,
  AlertDialogDescription,
} from "./components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "./components/ui/dialog";
import { SelectField } from "./SelectField";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { useRef, useState } from "react";
import {
  X,
  Plus,
  Upload,
  PanelRightClose,
  Folder,
  UserRound,
  KeyRound,
  LockKeyhole,
  Server,
  Pencil,
  Check,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { OsIcon } from "./OsIcon";
import type { HostDraft, View, IdentityForm, KeyForm } from "./types";
import type { ReactNode } from "react";
import { HostPasswordInput } from "./HostPasswordInput";
import { HostCredentialsField } from "./HostCredentialsField";
import { hostDraftIsDirty, hostDraftIsValid } from "./host-draft";

export function Panel({
  title,
  onClose,
  children,
  error,
  busy,
  className = "",
  dirty = false,
  variant = "sheet",
  footer,
  status,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  error: string;
  busy: boolean;
  className?: string;
  dirty?: boolean;
  variant?: "sheet" | "dialog" | "alert";
  footer?: ReactNode;
  status?: ReactNode;
}) {
  const [discarding, setDiscarding] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const Root = variant === "alert" ? AlertDialog : Dialog;
  const requestClose = () => {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  };
  return (
    <Root
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
      {...(variant === "alert"
        ? {}
        : { disablePointerDismissal: variant !== "sheet" })}
    >
      <DialogContent
        ref={popup}
        className={`panel ${variant === "sheet" ? "side-sheet" : "centered-panel"} ${className}`}
        initialFocus={
          variant === "alert"
            ? () =>
                popup.current?.querySelector<HTMLElement>(
                  "[data-alert-cancel]",
                ) ?? true
            : undefined
        }
        showCloseButton={false}
        aria-busy={busy}
      >
        <header>
          <DialogTitle render={<h2 />}>{title}</DialogTitle>
          {status}
          {variant !== "alert" && (
            <Button
              variant="ghost"
              type="button"
              aria-label="Chiudi pannello"
              onClick={requestClose}
              disabled={busy}
            >
              {variant === "sheet" ? (
                <PanelRightClose className="size-5" />
              ) : (
                <X size={18} />
              )}
            </Button>
          )}
        </header>
        <div className="panel-body" inert={busy ? true : undefined}>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {children}
        </div>
        {footer}
      </DialogContent>
      {discarding && (
        <Panel
          variant="alert"
          title="Scartare le modifiche?"
          busy={busy}
          error=""
          onClose={() => setDiscarding(false)}
        >
          <AlertDialogDescription>
            Le modifiche a questo modulo non sono state salvate.
          </AlertDialogDescription>
          <footer>
            <Button
              data-alert-cancel
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setDiscarding(false)}
            >
              Continua a modificare
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Scarta modifiche
            </Button>
          </footer>
        </Panel>
      )}
    </Root>
  );
}
function EditorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="editor-section">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}
export function HostEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  onNewIdentity,
  busy,
  error,
  saveStatus,
  hasUnsavedChanges,
  onRetrySave,
  onRevealPassword,
}: {
  value: HostDraft;
  onChange: (v: HostDraft) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  onNewIdentity: () => void;
  busy: boolean;
  error: string;
  saveStatus?: "idle" | "editing" | "saving" | "saved" | "error";
  hasUnsavedChanges?: boolean;
  onRetrySave?: () => void;
  onRevealPassword?: () => Promise<string>;
}) {
  const existing = view.hosts.find((h) => h.id === value.id);
  const credentials = value.credentials ?? {
    username: value.username ?? "",
    password: "",
  };
  const selectedIdentity = view.identities.find(
    (i) => i.id === value.identityId,
  );
  const dirty = hasUnsavedChanges ?? hostDraftIsDirty(value, existing);
  const valid = hostDraftIsValid(value, view.identities, existing);
  const StatusIcon =
    saveStatus === "saving"
      ? LoaderCircle
      : saveStatus === "saved"
        ? Check
        : saveStatus === "error"
          ? AlertCircle
          : Pencil;
  const statusLabel =
    saveStatus === "saving"
      ? "Salvataggio in corso"
      : saveStatus === "saved"
        ? "Salvato"
        : saveStatus === "error"
          ? "Salvataggio non riuscito"
          : "Modifiche non salvate";
  return (
    <Panel
      className="host-editor"
      title={
        view.hosts.some((h) => h.id === value.id)
          ? "Modifica host"
          : "Nuovo host"
      }
      {...{ onClose, busy, error }}
      dirty={dirty && (!saveStatus || !valid)}
      status={
        saveStatus && saveStatus !== "idle" ? (
          <span
            role="status"
            className={`sheet-save-state ${saveStatus}`}
            title={statusLabel}
          >
            <StatusIcon
              className={`size-4 ${saveStatus === "saving" ? "animate-spin" : ""}`}
            />
            <span className="visually-hidden">{statusLabel}</span>
          </span>
        ) : undefined
      }
      footer={
        <footer>
          {saveStatus === "error" && (
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={onRetrySave}
            >
              Riprova
            </Button>
          )}
          <Button
            variant="default"
            type="submit"
            form="host-editor-form"
            className="primary"
            disabled={busy || !valid}
          >
            Connetti
          </Button>
        </footer>
      }
    >
      <form
        id="host-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="editor-vault" aria-label="Vault corrente">
          <LockKeyhole className="size-5" aria-hidden="true" />
          <strong>{view.vaultName}</strong>
        </div>
        <EditorSection title="Indirizzo">
          <div className="host-address">
            {value.os ? (
              <OsIcon os={value.os} />
            ) : (
              <span className="address-icon">
                <Server className="size-5" aria-hidden="true" />
              </span>
            )}
            <label>
              <span className="visually-hidden">Indirizzo</span>
              <Input
                required
                value={value.address}
                onChange={(e) =>
                  onChange({ ...value, address: e.target.value })
                }
                placeholder="IP o nome host"
              />
            </label>
          </div>
        </EditorSection>
        <EditorSection title="Generale">
          <label className="sheet-field">
            <span className="visually-hidden">Nome</span>
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Nome dell’host"
            />
          </label>
          <label className="sheet-field sheet-control">
            <span className="visually-hidden">Cartella</span>
            <Folder className="field-icon" aria-hidden="true" />
            <Input
              value={value.group}
              onChange={(e) => onChange({ ...value, group: e.target.value })}
              list="host-groups"
              placeholder="Cartella (facoltativa)"
            />
            <datalist id="host-groups">
              {[
                ...new Set(
                  view.hosts.map((host) => host.group).filter(Boolean),
                ),
              ].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </datalist>
          </label>
        </EditorSection>
        <fieldset className="editor-section host-connection">
          <legend className="visually-hidden">Accesso SSH</legend>
          <label className="port-inline">
            Porta SSH
            <Input
              type="number"
              min={1}
              max={65535}
              required
              value={value.port}
              onChange={(e) =>
                onChange({ ...value, port: Number(e.target.value) })
              }
            />
          </label>
          <div className="sheet-divider" />
          <h3 className="credentials-heading">Credenziali</h3>
          <HostCredentialsField
            value={value}
            identities={view.identities}
            onChange={onChange}
            onNewIdentity={onNewIdentity}
          />
          <div className="sheet-field">
            <HostPasswordInput
              key={`${view.vaultId}:${value.id}:${value.identityId}`}
              hasSavedPassword={!!existing?.hasPassword && !value.identityId}
              onReveal={onRevealPassword}
              aria-label="Password SSH"
              required={!value.identityId && !existing?.hasPassword}
              disabled={!!selectedIdentity}
              autoComplete="new-password"
              value={selectedIdentity ? "" : credentials.password}
              placeholder={
                selectedIdentity ? "Gestita dall’identità" : "Password"
              }
              onChange={(e) =>
                onChange({
                  ...value,
                  credentials: { ...credentials, password: e.target.value },
                })
              }
            />
          </div>
          {!value.identityId && existing?.hasPassword && (
            <p className="help">
              Lascia vuoto per mantenere la password salvata.
            </p>
          )}
        </fieldset>
      </form>
    </Panel>
  );
}
export function IdentityEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  onNewKey,
  returnTo,
  busy,
  error,
}: {
  value: IdentityForm;
  onChange: (v: IdentityForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  onNewKey: () => void;
  returnTo?: string;
  busy: boolean;
  error: string;
}) {
  const existing = view.identities.find((i) => i.id === value.id);
  const dirty =
    !!value.password ||
    (existing
      ? (["name", "username", "auth", "keyId"] as const).some(
          (key) => value[key] !== existing[key],
        )
      : !!(
          value.name ||
          value.keyId ||
          value.username !== "root" ||
          value.auth !== "key"
        ));
  return (
    <Panel
      title={existing ? "Modifica identità" : "Nuova identità"}
      {...{ onClose, busy, error }}
      dirty={dirty}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo ? "Torna all’host" : "Annulla"}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="identity-editor-form"
            className="primary"
            disabled={busy || (value.auth === "key" && !value.keyId)}
          >
            {returnTo ? "Salva e torna all’host" : "Salva identità"}
          </Button>
        </footer>
      }
    >
      <form
        id="identity-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {returnTo && (
          <p className="help">
            Stai preparando l’accesso per un nuovo host. Dopo il salvataggio
            tornerai al modulo host, con i dati già inseriti.
          </p>
        )}
        <EditorSection title="Generale">
          <label>
            Nome
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Es. Amministrazione"
            />
          </label>
          <label>
            Utente SSH
            <Input
              required
              value={value.username}
              onChange={(e) => onChange({ ...value, username: e.target.value })}
              placeholder="root"
              autoComplete="off"
            />
          </label>
        </EditorSection>
        <EditorSection title="Accesso SSH">
          <label>
            Metodo
            <SelectField
              aria-label="Metodo di autenticazione"
              value={value.auth}
              onValueChange={(auth) =>
                onChange({
                  ...value,
                  auth: auth as "key" | "password",
                  password: "",
                  keyId: "",
                })
              }
              options={[
                { value: "key", label: "Chiave SSH" },
                { value: "password", label: "Password" },
              ]}
            />
          </label>
          {value.auth === "key" ? (
            <>
              <label>
                Chiave dal portachiavi
                <SelectField
                  aria-label="Chiave dal portachiavi"
                  required
                  value={value.keyId}
                  onValueChange={(keyId) => onChange({ ...value, keyId })}
                  placeholder="Seleziona una chiave"
                  options={view.keys.map((k) => ({
                    value: k.id,
                    label: k.name,
                  }))}
                />
              </label>
              <Button
                variant="ghost"
                className="link"
                type="button"
                onClick={onNewKey}
              >
                <Plus size={14} />
                Importa una chiave
              </Button>
            </>
          ) : (
            <label>
              Password
              <Input
                type="password"
                autoComplete="new-password"
                required={!existing?.hasPassword}
                value={value.password}
                onChange={(e) =>
                  onChange({ ...value, password: e.target.value })
                }
                placeholder={
                  existing?.hasPassword
                    ? "Lascia vuoto per mantenere quella salvata"
                    : ""
                }
              />
            </label>
          )}
          {existing && existing.hostCount > 0 && (
            <div className="callout">
              La modifica verrà usata dalle prossime connessioni di{" "}
              {existing.hostCount} host. Le sessioni già aperte restano attive.
            </div>
          )}
          <p className="help">
            Puoi assegnare questa identità a uno o più host. Identità con utenti
            diversi possono usare la stessa chiave.
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
export function KeyEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  busy,
  error,
  returnTo,
}: {
  value: KeyForm;
  onChange: (v: KeyForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string;
  returnTo?: string;
}) {
  const existing = view.keys.find((k) => k.id === value.id);
  const file = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");
  return (
    <Panel
      title={existing ? "Modifica chiave SSH" : "Importa chiave SSH"}
      {...{ onClose, busy }}
      error={fileError || error}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo ? "Torna all’identità" : "Annulla"}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="key-editor-form"
            className="primary"
            disabled={busy}
          >
            {returnTo
              ? "Importa e torna all’identità"
              : existing
                ? "Salva chiave"
                : "Importa chiave"}
          </Button>
        </footer>
      }
      dirty={
        !!(
          value.privateKey ||
          value.passphrase ||
          value.name !== (existing?.name ?? "")
        )
      }
    >
      <form
        id="key-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {returnTo && (
          <p className="help">
            Importa la chiave da usare per questa identità. Il modulo precedente
            conserva i dati già inseriti.
          </p>
        )}
        <EditorSection title="Generale">
          <label>
            Nome
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Es. Chiave personale"
            />
          </label>
          {existing && (
            <>
              <label>
                Impronta pubblica
                <code className="fingerprint">
                  {existing.fingerprint ||
                    "Non verificata: reimporta la chiave per validarla"}
                </code>
              </label>
              <p className="help">
                Usata da {existing.identityCount} identità e{" "}
                {existing.hostCount} host. Per rinominare la chiave, lascia
                vuoti i campi qui sotto.
              </p>
            </>
          )}
        </EditorSection>
        <EditorSection title="Chiave privata">
          <input
            ref={file}
            type="file"
            tabIndex={-1}
            className="visually-hidden"
            aria-label="File della chiave privata"
            onChange={async (e) => {
              setFileError("");
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 1024 * 1024)
                  throw new Error("File troppo grande (massimo 1 MB)");
                const text = await f.text();
                onChange({
                  ...value,
                  privateKey: text,
                  name: value.name || f.name,
                });
              } catch (err) {
                setFileError(String(err));
              }
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            type="button"
            onClick={() => file.current?.click()}
          >
            <Upload size={15} />
            Scegli file della chiave privata
          </Button>
          <label>
            {existing
              ? "Sostituisci chiave privata (opzionale)"
              : "Chiave privata"}
            <Textarea
              rows={9}
              spellCheck={false}
              autoComplete="off"
              required={!existing}
              value={value.privateKey}
              onChange={(e) =>
                onChange({ ...value, privateKey: e.target.value })
              }
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            />
          </label>
          <label>
            Passphrase della chiave
            <Input
              type="password"
              autoComplete="new-password"
              value={value.passphrase}
              onChange={(e) =>
                onChange({ ...value, passphrase: e.target.value })
              }
              disabled={!!existing && !value.privateKey}
              placeholder="Se la chiave è protetta"
            />
          </label>
          {existing && value.privateKey && (
            <div className="callout">
              Sostituire la chiave modifica le prossime connessioni di tutte le
              identità che la utilizzano.
            </div>
          )}
          <p className="help">
            La chiave viene importata nel vault cifrato. Il file originale non
            viene modificato.
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
