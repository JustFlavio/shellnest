import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import type { VaultApi } from "@/features/vault/useVault";
import type { View } from "@/lib/types";
import type { Trust } from "./tabs-types";
import type { CloseTabs } from "./useCloseTabs";
import type { HostConnections } from "./useHostConnections";
import type { TabList } from "./useTabList";
import type { Workspaces } from "./useWorkspaces";

export function useTrust(
  { run, update, invokeScoped }: VaultApi,
  list: TabList,
  {
    skipQueued,
    dropQueue,
    stopVerifying,
    continueConnections,
  }: HostConnections,
  { closeTab }: CloseTabs,
  { openWorkspaces }: Workspaces,
  trust: Trust | null,
  setTrust: (trust: Trust | null) => void,
) {
  const { t } = useTranslation();
  const approveTrust = () =>
    void run(async () => {
      if (!trust) return;
      if (trust.quick) {
        // The pane that asked starts its session now; the fingerprint is not kept.
        list.setTabs((old) =>
          old.map((tab) =>
            tab.id === trust.tabId && tab.kind === "quick"
              ? {
                  ...tab,
                  target: {
                    ...tab.target,
                    expectedFingerprint: trust.fingerprint,
                  },
                }
              : tab,
          ),
        );
      } else if (trust.host) {
        await invokeScoped("trust_host", {
          id: trust.host.id,
          expected: trust.fingerprint,
          address: trust.host.address,
          port: trust.host.port,
        });
        const next = await invokeScoped<View>("status");
        update(next);
        const approved = next.hosts.find((h) => h.id === trust.host!.id);
        if (!approved?.fingerprint)
          throw new Error(t("terminal.useTrust.fingerprintNotSaved"));
        if (trust.workspaces) {
          setTrust(null);
          await openWorkspaces(trust.workspaces, next.hosts, trust.activeIndex);
          return;
        }
        if (trust.tabId && stopVerifying(trust.tabId)) {
          list.setTabs((old) =>
            old.map((tab) =>
              tab.id === trust.tabId && tab.kind === "ssh"
                ? { ...tab, host: approved }
                : tab,
            ),
          );
        }
        skipQueued();
      }
      setTrust(null);
      await continueConnections();
    });
  // Closing the pane that waits for an answer is a refusal too: stop the remaining opens.
  useEffect(() => {
    if (!trust?.tabId || list.tabs.some((t) => t.id === trust.tabId)) return;
    dropQueue();
    stopVerifying(trust.tabId);
    setTrust(null);
  }, [trust, list.tabs, dropQueue, stopVerifying, setTrust]);
  const rejectTrust = () => {
    dropQueue();
    if (trust?.tabId) closeTab(trust.tabId);
    setTrust(null);
  };
  return { approveTrust, rejectTrust };
}
