import { useRef } from "react";
import type { VaultApi } from "@/features/vault/useVault";
import { hostIdentity } from "@/features/hosts/host-draft";
import type { Host, QuickTarget } from "@/lib/types";
import { localTab, quickTab, sshTab } from "./tab-factory";
import type { QuickConnection, Trust } from "./tabs-types";
import type { TabList } from "./useTabList";

/** Opening sessions: hosts one after the other (verifying unknown host keys), local shell, quick connections. */
export function useHostConnections(
  { view, preview, run, invokeScoped, setError }: VaultApi,
  list: TabList,
  setTrust: (trust: Trust) => void,
) {
  // Hosts still to open, and the tabs waiting for their host key to be verified.
  const queue = useRef<Host[]>([]),
    verifying = useRef(new Set<string>());
  const identity = (host: Host) => hostIdentity(view.identities, host);
  const openTab = (host: Host) => {
    const tab = sshTab(host, identity(host), view.vaultId);
    list.addTab(tab);
    return tab.id;
  };
  const continueConnections = async () => {
    let pendingTab: string | undefined;
    try {
      while (queue.current.length) {
        const host = queue.current[0];
        const tabId = openTab(host);
        if (!host.fingerprint) {
          pendingTab = tabId;
          verifying.current.add(tabId);
          const fingerprint = await invokeScoped<string>("probe_host", {
            id: host.id,
          });
          if (!verifying.current.has(tabId)) return;
          setTrust({ host, fingerprint, tabId });
          return;
        }
        queue.current.shift();
      }
    } catch (e) {
      queue.current = [];
      if (pendingTab) {
        if (!verifying.current.delete(pendingTab)) return;
        list.setTabs((old) =>
          old.map((tab) =>
            tab.id === pendingTab
              ? { ...tab, status: "failed", error: String(e) }
              : tab,
          ),
        );
      }
      throw e;
    }
  };
  const connectHosts = (hosts: Host[]) =>
    void run(async () => {
      if (
        hosts.some(
          (host) => !identity(host) && !(host.username && host.hasPassword),
        )
      )
        throw new Error("Completa le credenziali degli host selezionati.");
      queue.current = [...hosts];
      await continueConnections();
    });
  const connect = (host: Host) => connectHosts([host]);
  const openLocal = () => {
    if (preview) {
      setError("Il terminale locale funziona nell’app desktop.");
      return;
    }
    list.addTab(localTab(view.vaultId));
  };
  const openQuick = (target: QuickTarget) => {
    const i = view.identities.find((i) => i.id === target.identityId);
    if (!i) throw new Error("Identità non disponibile");
    list.addTab(quickTab(target, i, view.vaultId));
  };
  const quickConnect = (target: QuickConnection) =>
    void run(async () => {
      if (preview)
        throw new Error("Le connessioni funzionano nell’app desktop.");
      const fingerprint = await invokeScoped<string>("probe_target", {
        address: target.address,
        port: target.port,
      });
      setTrust({ quick: target, fingerprint });
    });
  return {
    queue,
    verifying,
    continueConnections,
    connectHosts,
    connect,
    openLocal,
    openQuick,
    quickConnect,
  };
}

export type HostConnections = ReturnType<typeof useHostConnections>;
