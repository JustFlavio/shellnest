import { emptyView } from "../types";
import type { Group, View } from "../types";

export function previewView(): View {
  const groups: Group[] = ["Produzione", "Staging", "Sviluppo"].map((name) => ({
    id: `group-${name.toLowerCase()}`,
    name,
    parentId: "",
    identityId: "",
    port: null,
  }));
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
    groups,
    workspaces: [
      {
        id: "preview-workspace",
        name: "Produzione",
        layout: {
          dir: "row",
          ratio: 0.5,
          a: { hostId: "preview-0" },
          b: { hostId: "preview-1" },
        },
      },
    ],
    hosts: Array.from({ length: 34 }, (_, i) => ({
      id: `preview-${i}`,
      name: `${["api", "database", "worker", "web", "monitoring"][i % 5]}-${String(Math.floor(i / 5) + 1).padStart(2, "0")}`,
      address: `192.0.2.${i + 10}`,
      port: 22,
      ownPort: 22,
      // The last four hosts stay outside any folder.
      groupId: i < 30 ? groups[Math.floor(i / 10)].id : "",
      identityId: i < 20 ? "identity-deploy" : "identity-admin",
      effectiveIdentityId: i < 20 ? "identity-deploy" : "identity-admin",
      identitySource: "",
      // The last host stays unverified to exercise the trust dialog.
      fingerprint: i === 33 ? "" : "SHA256:impronta-dimostrativa",
      os: i % 5 === 0 ? "debian" : "ubuntu",
      lastConnectedAt: Date.now() - i * 300000,
    })),
  };
}
