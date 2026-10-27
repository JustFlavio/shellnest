import { useState } from "react";
import { emptySetup } from "./quick-setup.ts";
import type { QuickSetup } from "./quick-setup.ts";

export type QuickStage = "user" | "method";

/** The answers of a quick connection's questions, kept while the timeline moves from one to the next. */
export function useQuickSetup(address: string, username: string) {
  const [setup, setSetup] = useState(() => emptySetup(address, username));
  const [stage, setStage] = useState<QuickStage>("user");
  const patch = (change: Partial<QuickSetup>) =>
    setSetup((old) => ({ ...old, ...change }));
  return { setup, stage, setStage, patch };
}
export type QuickSetupState = ReturnType<typeof useQuickSetup>;
