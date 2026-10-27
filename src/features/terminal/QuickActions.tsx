import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canSave, quickLogin } from "./quick-setup.ts";
import type { QuickSetup } from "./quick-setup.ts";
import { help } from "@/lib/editor-ui";

/** Where a quick connection's questions end: connect once, or save the host and connect. */
export function QuickActions({
  setup,
  busy,
  onName,
  onSubmit,
}: {
  setup: QuickSetup;
  busy: boolean;
  onName: (name: string) => void;
  onSubmit: (save: boolean) => void;
}) {
  const ready = !!quickLogin(setup) && !busy;
  return (
    <>
      <label className="mt-[12px] block text-[12px]">
        Nome per “Continua e salva”
        <Input
          value={setup.name}
          maxLength={80}
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      {!setup.identityId && setup.method === "password" && !setup.password && (
        <p className={help + " mb-0"}>Per salvare l’host serve una password.</p>
      )}
      <div className="mt-[12px] flex flex-wrap justify-end gap-[8px]">
        <Button
          variant="outline"
          type="button"
          disabled={!ready || !canSave(setup)}
          onClick={() => onSubmit(true)}
        >
          Continua e salva
        </Button>
        <Button type="submit" disabled={!ready}>
          Continua
        </Button>
      </div>
    </>
  );
}
