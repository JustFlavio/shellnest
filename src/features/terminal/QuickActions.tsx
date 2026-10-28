import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canSave, quickLogin } from "./quick-setup.ts";
import type { QuickSetup } from "./quick-setup.ts";
import { help } from "@/lib/editor-ui";

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
  const { t } = useTranslation();
  const ready = !!quickLogin(setup) && !busy;
  return (
    <>
      <label className="mt-[12px] block text-[12px]">
        {t("terminal.quickActions.nameForContinueAnd")}
        <Input
          value={setup.name}
          maxLength={80}
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      {!setup.identityId && setup.method === "password" && !setup.password && (
        <p className={help + " mb-0"}>
          {t("terminal.quickActions.aPasswordIsNeeded")}
        </p>
      )}
      <div className="mt-[12px] flex flex-wrap justify-end gap-[8px]">
        <Button
          variant="outline"
          type="button"
          disabled={!ready || !canSave(setup)}
          onClick={() => onSubmit(true)}
        >
          {t("terminal.quickActions.continueAndSave")}
        </Button>
        <Button type="submit" disabled={!ready}>
          {t("terminal.quickActions.continue")}
        </Button>
      </div>
    </>
  );
}
