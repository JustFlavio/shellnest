import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { KeyRound, Pencil, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Identity, SshKey } from "@/lib/types";

type Shared = {
  busy: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onUsage: (ids: string[], label: string) => void;
};

function Table({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
      <thead className="sticky top-0 z-1">
        <tr>
          {heads.map((h, i) => (
            <th
              key={h}
              className={cn(
                "h-9 border-b border-border bg-sidebar px-3 text-xs font-medium whitespace-nowrap text-muted-foreground",
                i === heads.length - 1 && "w-24 text-right",
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

const cell =
  "h-12 border-b border-border/60 px-3 align-middle whitespace-nowrap";

function Row({
  name,
  onEdit,
  onDelete,
  deleteHint,
  canDelete,
  busy,
  children,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteHint: string;
  canDelete: boolean;
  busy: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <tr
      className="group animate-in cursor-pointer fade-in duration-300 hover:bg-card"
      onDoubleClick={(e) => {
        if (!busy && !(e.target as HTMLElement).closest("button")) onEdit();
      }}
    >
      {children}
      <td className={cn(cell, "text-right")}>
        <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            type="button"
            size="icon-sm"
            aria-label={t("hosts.collectionTables.editName", { name })}
            disabled={busy}
            onClick={onEdit}
          >
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            type="button"
            size="icon-sm"
            className="hover:bg-destructive/15 hover:text-destructive"
            aria-label={t("hosts.collectionTables.deleteName", { name })}
            disabled={busy || !canDelete}
            title={deleteHint}
            onClick={onDelete}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

const nameButton =
  "h-auto justify-start gap-2 p-0 text-[13px] text-foreground hover:bg-transparent hover:text-primary";
const linkButton =
  "h-auto justify-start p-0 text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground";

export function IdentitiesTable({
  identities,
  keys,
  ...p
}: Shared & { identities: Identity[]; keys: SshKey[] }) {
  const { t } = useTranslation();
  return (
    <Table
      heads={[
        t("vault.vaultPanels.name"),
        t("hosts.collectionTables.sshUser"),
        t("hosts.collectionTables.methodKey"),
        t("hosts.collectionTables.usage"),
        t("hosts.collectionTables.actions"),
      ]}
    >
      {identities.map((i) => (
        <Row
          key={i.id}
          name={i.name}
          busy={p.busy}
          canDelete={i.hostCount === 0}
          deleteHint={
            i.hostCount
              ? t("hosts.collectionTables.reassignTheHostsThat")
              : t("hosts.collectionTables.deleteIdentity")
          }
          onEdit={() => p.onEdit(i.id)}
          onDelete={() => p.onDelete(i.id, i.name)}
        >
          <td className={cell}>
            <Button
              variant="ghost"
              type="button"
              className={nameButton}
              disabled={p.busy}
              onClick={() => p.onEdit(i.id)}
            >
              <UserRound size={15} className="text-primary" />
              {i.name}
            </Button>
          </td>
          <td className={cn(cell, "font-mono text-xs")}>{i.username}</td>
          <td className={cell}>
            {i.auth === "key" ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <KeyRound size={13} />
                {keys.find((k) => k.id === i.keyId)?.name ??
                  t("hosts.collectionTables.keyMissing")}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t("hosts.collectionTables.password")}
              </span>
            )}
          </td>
          <td className={cell}>
            <Button
              variant="ghost"
              type="button"
              className={linkButton}
              onClick={() => p.onUsage([i.id], i.name)}
            >
              {i.hostCount} host
            </Button>
          </td>
        </Row>
      ))}
    </Table>
  );
}

export function KeysTable({
  keys,
  identities,
  ...p
}: Shared & { keys: SshKey[]; identities: Identity[] }) {
  const { t } = useTranslation();
  return (
    <Table
      heads={[
        t("vault.vaultPanels.name"),
        t("hosts.collectionTables.publicFingerprint"),
        t("hosts.collectionTables.usage"),
        t("hosts.collectionTables.actions"),
      ]}
    >
      {keys.map((k) => (
        <Row
          key={k.id}
          name={k.name}
          busy={p.busy}
          canDelete={k.identityCount === 0}
          deleteHint={
            k.identityCount
              ? t("hosts.collectionTables.reassignTheIdentitiesThat")
              : t("hosts.collectionTables.deleteKey")
          }
          onEdit={() => p.onEdit(k.id)}
          onDelete={() => p.onDelete(k.id, k.name)}
        >
          <td className={cell}>
            <Button
              variant="ghost"
              type="button"
              className={nameButton}
              disabled={p.busy}
              onClick={() => p.onEdit(k.id)}
            >
              <KeyRound size={15} className="text-primary" />
              {k.name}
            </Button>
          </td>
          <td
            className={cn(
              cell,
              "max-w-96 truncate font-mono text-xs text-muted-foreground",
            )}
          >
            {k.fingerprint || t("hosts.collectionTables.toVerify")}
          </td>
          <td className={cell}>
            <Button
              variant="ghost"
              type="button"
              className={linkButton}
              onClick={() =>
                p.onUsage(
                  identities.filter((i) => i.keyId === k.id).map((i) => i.id),
                  k.name,
                )
              }
            >
              {t("common.identityCount", { count: k.identityCount })} ·{" "}
              {t("common.hostCount", { count: k.hostCount })}
            </Button>
          </td>
        </Row>
      ))}
    </Table>
  );
}
