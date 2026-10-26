import { emptyView } from "./types";
import type {
  View,
  Host,
  IdentityForm,
  KeyForm,
  HostCredentials,
} from "./types";

// Only UI metadata lives here: passwords, private keys and tokens are discarded.
export function createPreviewBackend() {
  const vaults = new Map<string, View>([["personal", previewView()]]);
  let selected = "personal";
  return async <T>(
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    if (command === "select_vault") {
      if (!vaults.has(String(args.vaultId)))
        throw new Error("Vault non disponibile");
      selected = String(args.vaultId);
    }
    const current = vaults.get(selected)!;
    if (args.vaultId && args.vaultId !== selected)
      throw new Error("Vault non attivo");
    const next = structuredClone(current);
    const requireValue = (condition: unknown, message: string) => {
      if (!condition) throw new Error(message);
    };
    if (
      ![
        "status",
        "select_vault",
        "unlock",
        "create_vault",
        "rename_vault",
      ].includes(command)
    )
      requireValue(next.unlocked, "Sblocca prima il vault");
    switch (command) {
      case "status":
      case "select_vault":
        break;
      case "unlock":
        requireValue(
          typeof args.password === "string" &&
            args.password.length >= (next.exists ? 1 : 12),
          "Inserisci una password fittizia valida",
        );
        next.exists = true;
        next.unlocked = true;
        break;
      case "lock":
        next.unlocked = false;
        break;
      case "create_vault": {
        requireValue(
          typeof args.name === "string" &&
            args.name.trim() &&
            args.name.length <= 80,
          "Assegna un nome al vault (massimo 80 caratteri)",
        );
        const id = crypto.randomUUID();
        vaults.set(id, {
          ...structuredClone(emptyView),
          vaultId: id,
          vaultName: String(args.name).trim(),
        });
        selected = id;
        return snapshot() as T;
      }
      case "rename_vault":
        requireValue(
          typeof args.name === "string" &&
            args.name.trim() &&
            args.name.length <= 80,
          "Assegna un nome al vault (massimo 80 caratteri)",
        );
        next.vaultName = String(args.name).trim();
        break;
      case "reveal_host_password": {
        const host = next.hosts.find((h) => h.id === args.id);
        requireValue(
          host && !host.identityId && host.hasPassword,
          "Questo host non ha una password privata salvata",
        );
        // Preview never retains entered secrets; reveal only a labelled sample.
        return "password-dimostrativa" as T;
      }
      case "save_host": {
        const host = args.host as Host;
        requireValue(
          host?.id &&
            host.name?.trim() &&
            host.address?.trim() &&
            host.address.length <= 253 &&
            !/[\s\x00-\x1f\x7f/@\\[\]]/.test(host.address) &&
            Number.isInteger(host.port) &&
            host.port > 0 &&
            host.port <= 65535,
          "Nome, indirizzo e porta valida sono obbligatori",
        );
        const previous = next.hosts.find((h) => h.id === host.id);
        let username: string | null = null;
        let hasPassword = false;
        if (!host.identityId) {
          const credentials = args.credentials as HostCredentials | undefined;
          requireValue(
            credentials == null ||
              (typeof credentials.username === "string" &&
                typeof credentials.password === "string"),
            "Credenziali non valide",
          );
          username = credentials?.username?.trim() ?? previous?.username ?? "";
          hasPassword =
            !!credentials?.password ||
            !!(!previous?.identityId && previous?.hasPassword);
          requireValue(
            username &&
              !/[\s\x00-\x1f\x7f]/.test(username) &&
              hasPassword &&
              (credentials == null || typeof credentials.password === "string"),
            "Inserisci utente SSH e password per questo host",
          );
        } else {
          requireValue(
            args.credentials == null,
            "Scegli credenziali dell’host oppure un’identità",
          );
          requireValue(
            next.identities.some((i) => i.id === host.identityId),
            "Seleziona un’identità valida",
          );
        }
        const old = next.hosts.find(
          (h) =>
            h.id === host.id &&
            h.address === host.address &&
            h.port === host.port,
        );
        const saved: Host = {
          id: host.id,
          name: host.name,
          address: host.address,
          port: host.port,
          group: host.group,
          identityId: host.identityId,
          username,
          hasPassword,
          fingerprint: old?.fingerprint ?? "",
          os: old?.os,
          lastConnectedAt: old?.lastConnectedAt,
        };
        next.hosts = [...next.hosts.filter((h) => h.id !== host.id), saved];
        break;
      }
      case "save_identity": {
        const identity = args.identity as IdentityForm;
        requireValue(
          identity?.id && identity.name?.trim() && identity.username?.trim(),
          "Nome e utente SSH sono obbligatori",
        );
        requireValue(
          identity.auth === "key" || identity.auth === "password",
          "Metodo di autenticazione non valido",
        );
        const old = next.identities.find((i) => i.id === identity.id);
        const hasPassword =
          identity.auth === "password" &&
          (!!identity.password || !!old?.hasPassword);
        requireValue(
          identity.auth === "password"
            ? hasPassword
            : next.keys.some((k) => k.id === identity.keyId),
          "Seleziona una chiave o inserisci una password fittizia",
        );
        next.identities = [
          ...next.identities.filter((i) => i.id !== identity.id),
          {
            id: identity.id,
            name: identity.name,
            username: identity.username,
            auth: identity.auth,
            keyId: identity.auth === "key" ? identity.keyId : "",
            hasPassword,
            hostCount: 0,
          },
        ];
        break;
      }
      case "save_key": {
        const key = args.key as KeyForm;
        const old = next.keys.find((k) => k.id === key?.id);
        requireValue(
          key?.id && key.name?.trim() && (old || key.privateKey?.trim()),
          "Nome e chiave fittizia sono obbligatori",
        );
        next.keys = [
          ...next.keys.filter((k) => k.id !== key.id),
          {
            id: key.id,
            name: key.name,
            fingerprint: key.privateKey
              ? "Anteprima: chiave non verificata"
              : old!.fingerprint,
            identityCount: 0,
            hostCount: 0,
          },
        ];
        break;
      }
      case "delete_host":
        next.hosts = next.hosts.filter((h) => h.id !== args.id);
        break;
      case "delete_identity":
        requireValue(
          !next.hosts.some((h) => h.identityId === args.id),
          "Riassegna prima gli host che utilizzano questa identità",
        );
        next.identities = next.identities.filter((i) => i.id !== args.id);
        break;
      case "delete_key":
        requireValue(
          !next.identities.some((i) => i.keyId === args.id),
          "Riassegna prima le identità che utilizzano questa chiave",
        );
        next.keys = next.keys.filter((k) => k.id !== args.id);
        break;
      case "assign_identity": {
        const ids = args.ids as string[];
        requireValue(
          Array.isArray(ids) &&
            ids.length &&
            ids.every((id) => next.hosts.some((h) => h.id === id)) &&
            next.identities.some((i) => i.id === args.identityId),
          "Seleziona host e identità validi",
        );
        next.hosts = next.hosts.map((h) =>
          ids.includes(h.id)
            ? {
                ...h,
                identityId: String(args.identityId),
                username: null,
                hasPassword: false,
              }
            : h,
        );
        break;
      }
      case "configure_sync": {
        const url = new URL(String(args.url));
        requireValue(
          url.protocol === "https:" ||
            (url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)),
          "Usa HTTPS per la sincronizzazione remota",
        );
        requireValue(
          next.syncConfigured ||
            (typeof args.token === "string" && args.token.length >= 32),
          "Il token deve contenere almeno 32 caratteri fittizi",
        );
        next.syncUrl = url.toString();
        next.syncConfigured = true;
        break;
      }
      default:
        throw new Error(
          "Questa funzione richiede l’app desktop. L’anteprima non apre connessioni di rete.",
        );
    }
    vaults.set(selected, next);
    return snapshot() as T;

    function snapshot(): View {
      const view = structuredClone(vaults.get(selected)!);
      view.vaults = [...vaults.values()].map((v) => ({
        id: v.vaultId,
        name: v.vaultName,
        exists: v.exists,
      }));
      view.identities.forEach((i) => {
        i.hostCount = view.hosts.filter((h) => h.identityId === i.id).length;
      });
      view.keys.forEach((k) => {
        const ids = view.identities
          .filter((i) => i.keyId === k.id)
          .map((i) => i.id);
        k.identityCount = ids.length;
        k.hostCount = view.hosts.filter((h) =>
          ids.includes(h.identityId),
        ).length;
      });
      if (!view.unlocked) {
        view.hosts = [];
        view.identities = [];
        view.keys = [];
      }
      return view;
    }
  };
}

export function previewView(): View {
  const groups = ["Produzione", "Staging", "Sviluppo"];
  return {
    ...emptyView,
    exists: true,
    unlocked: true,
    vaults: [{ id: "personal", name: "Personale", exists: true }],
    keys: [
      {
        id: "key-personal",
        name: "Personale",
        fingerprint: "SHA256:impronta-dimostrativa",
        identityCount: 2,
        hostCount: 30,
      },
    ],
    identities: [
      {
        id: "identity-deploy",
        name: "Deploy",
        username: "deploy",
        auth: "key",
        keyId: "key-personal",
        hasPassword: false,
        hostCount: 20,
      },
      {
        id: "identity-admin",
        name: "Amministrazione",
        username: "root",
        auth: "key",
        keyId: "key-personal",
        hasPassword: false,
        hostCount: 10,
      },
    ],
    hosts: Array.from({ length: 30 }, (_, i) => ({
      id: `preview-${i}`,
      name: `${["api", "database", "worker", "web", "monitoring"][i % 5]}-${String(Math.floor(i / 5) + 1).padStart(2, "0")}`,
      address: `192.0.2.${i + 10}`,
      port: 22,
      group: groups[Math.floor(i / 10)],
      identityId: i < 20 ? "identity-deploy" : "identity-admin",
      fingerprint: "",
      os: i % 5 === 0 ? "debian" : "ubuntu",
      lastConnectedAt: Date.now() - i * 300000,
    })),
  };
}
