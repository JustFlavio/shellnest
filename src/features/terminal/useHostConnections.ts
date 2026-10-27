import { useRef } from "react";
import type { VaultApi } from "@/features/vault/useVault";
import { hostIdentity } from "@/features/hosts/host-draft";
import { hostDraftIsValid } from "@/features/hosts/host-draft";
import { saveHostCommand } from "@/features/hosts/save-host";
import { notifyError } from "@/lib/notify";
import { newHost } from "@/lib/types";
import type { Host, TerminalTab, View } from "@/lib/types";
import type { ConnectionTarget } from "./connection-target.ts";
import { holdQuickPassword, takeQuickPassword } from "./quick-password";
import { hostToSave, identityForKey, quickLogin } from "./quick-setup.ts";
import type { QuickSetup } from "./quick-setup.ts";
import { localTab, quickTab, sshTab } from "./tab-factory";
import type { Trust } from "./tabs-types";
import type { TabList } from "./useTabList";

/** Opening sessions: hosts one after the other (verifying unknown host keys), local shell, quick connections. */
export function useHostConnections(
  { view, preview, run, invokeScoped, update }: VaultApi,
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
        // The tab's timeline shows this failure.
        return;
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
    }, "Connessione non riuscita");
  const connect = (host: Host) => connectHosts([host]);
  const openLocal = () => {
    if (preview) {
      notifyError(
        "Terminale locale non disponibile",
        "Il terminale locale funziona nell’app desktop.",
      );
      return;
    }
    list.addTab(localTab(view.vaultId));
  };
  // A quick connection starts as a draft tab: the timeline asks for the rest.
  const startQuick = (target: ConnectionTarget) =>
    list.addTab(quickTab(target, view.vaultId));
  // The answers of the quick-connection form: optionally save the host, then verify the host key.
  const finishQuick = (tab: TerminalTab, setup: QuickSetup, save: boolean) =>
    void run(async () => {
      const login = quickLogin(setup);
      if (tab.kind !== "quick" || !login)
        throw new Error("Completa i dati di accesso.");
      const keyName = (id: string) =>
        view.keys.find((k) => k.id === id)?.name ?? "";
      let identityId = login.kind === "identity" ? login.id : "";
      let identities = view.identities;
      if (save) {
        if (login.kind === "key") {
          const found = identityForKey(
            identities,
            setup.username,
            login.id,
            keyName(login.id),
          );
          if (found.isNew) {
            const next = await invokeScoped<View>("save_identity", {
              identity: {
                id: found.id,
                name: found.name,
                username: setup.username,
                auth: "key",
                keyId: login.id,
                password: "",
              },
            });
            update(next);
            identities = next.identities;
          }
          identityId = found.id;
        }
        const draft = hostToSave(setup, tab.target, newHost(), identityId);
        if (!hostDraftIsValid(draft, identities, undefined, view.groups))
          throw new Error(
            "I dati dell’host non sono validi per il salvataggio.",
          );
        update(await saveHostCommand(invokeScoped, draft));
      }
      if (login.kind === "password" && setup.password)
        holdQuickPassword(tab.id, setup.password);
      const target = { ...tab.target, username: setup.username, login };
      const identityName =
        login.kind === "identity"
          ? (view.identities.find((i) => i.id === login.id)?.name ?? "")
          : login.kind === "key"
            ? keyName(login.id)
            : "Password";
      const patch = (change: Partial<TerminalTab>) =>
        list.setTabs((old) =>
          old.map((t) =>
            t.id === tab.id ? ({ ...t, ...change } as TerminalTab) : t,
          ),
        );
      patch({ username: setup.username, identityName, target });
      try {
        const fingerprint = await invokeScoped<string>("probe_target", {
          address: target.address,
          port: target.port,
        });
        setTrust({ quick: target, fingerprint, tabId: tab.id });
      } catch (e) {
        takeQuickPassword(tab.id);
        patch({ status: "failed", error: String(e) });
      }
    }, "Connessione non riuscita");
  return {
    queue,
    verifying,
    continueConnections,
    connectHosts,
    connect,
    openLocal,
    startQuick,
    finishQuick,
  };
}

export type HostConnections = ReturnType<typeof useHostConnections>;
