import { Button } from "@/components/ui/button";
import { help, muted } from "@/lib/editor-ui";
import type { ConnectionTarget } from "./connection-target.ts";

export function QuickConnectForm({
  target,
  canConnect,
  onSubmit,
}: {
  target: ConnectionTarget;
  canConnect: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-[18px] rounded-[9px] border border-input bg-card p-[18px] [&_h2]:mb-[9px]"
      onSubmit={(event) => {
        event.preventDefault();
        if (canConnect) onSubmit();
      }}
    >
      <h2>Connessione rapida</h2>
      <p className={muted}>
        <code>
          {target.username ? `${target.username}@` : ""}
          {target.address.includes(":")
            ? `[${target.address}]`
            : target.address}
          :{target.port}
        </code>
      </p>
      <Button variant="default" type="submit" disabled={!canConnect}>
        Connetti
      </Button>
      <p className={help}>
        Utente e credenziali si scelgono nella connessione, senza salvare un
        host a meno che tu non lo chieda.
      </p>
    </form>
  );
}
