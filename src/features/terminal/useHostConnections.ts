import { useTranslation } from "react-i18next";
import { useCallback, useRef } from "react";
import { toMessage } from "@/i18n/message";
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

export function useHostConnections(
  { view, preview, run, invokeScoped, update }: VaultApi,
  list: TabList,
  setTrust: (trust: Trust) => void,
) {
  const { t } = useTranslation();
  // Hosts still to open, and the tabs waiting for their host key to be verified.
  const queue = useRef<Host[]>([]),
    verifying = useRef(new Set<string>());
  const queuedView = useRef<"files" | undefined>(undefined);
  const identity = (host: Host) => hostIdentity(view.identities, host);
  const openTab = (host: Host) => {
    const tab = sshTab(host, identity(host), view.vaultId);
    list.addTab({
      ...tab,
      initialView: queuedView.current,
      view: queuedView.current,
    });
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
              ? { ...tab, status: "failed", error: toMessage(e) }
              : tab,
          ),
        );
        // The tab's timeline shows this failure.
        return;
      }
      throw e;
    }
  };
  const connectHosts = (hosts: Host[], initialView?: "files") =>
    void run(async () => {
      if (
        hosts.some(
          (host) =>
            !identity(host) &&
            !(host.username && (host.hasPassword || host.keyId)),
        )
      )
        throw new Error(
          t("terminal.useHostConnections.completeTheCredentialsOf"),
        );
      queuedView.current = initialView;
      queue.current = [...hosts];
      await continueConnections();
    }, t("terminal.useHostConnections.connectionFailed"));
  const connect = (host: Host) => connectHosts([host]);
  const openLocal = () => {
    if (preview) {
      notifyError(
        t("terminal.useHostConnections.localTerminalNotAvailable"),
        t("terminal.useHostConnections.theLocalTerminalWorks"),
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
        throw new Error(t("terminal.useHostConnections.completeTheSignIn"));
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
          throw { code: "model.HostCredentialsInvalid" };
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
            : "";
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
        patch({ status: "failed", error: toMessage(e) });
      }
    }, t("terminal.useHostConnections.connectionFailed"));
  // Other hooks drive the queue through these, so the refs stay private to this hook.
  const skipQueued = useCallback(() => {
    queue.current.shift();
  }, []);
  const dropQueue = useCallback(() => {
    queue.current = [];
  }, []);
  const stopVerifying = useCallback(
    (tabId: string) => verifying.current.delete(tabId),
    [],
  );
  const resetConnections = useCallback(() => {
    queue.current = [];
    verifying.current.clear();
  }, []);
  return {
    skipQueued,
    dropQueue,
    stopVerifying,
    resetConnections,
    continueConnections,
    connectHosts,
    connect,
    openFiles: (host: Host) => connectHosts([host], "files"),
    openLocal,
    startQuick,
    finishQuick,
  };
}

export type HostConnections = ReturnType<typeof useHostConnections>;
