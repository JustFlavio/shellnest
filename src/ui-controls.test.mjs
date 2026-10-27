import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// The existing Node runner can check TSX controls without another test framework.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = new URL(`./${specifier.slice(2)}`, import.meta.url);
      for (const extension of ["", ".tsx", ".ts"]) {
        const url = new URL(base.href + extension);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    if (specifier.startsWith(".") && context.parentURL) {
      for (const extension of [".tsx", ".ts"]) {
        const url = new URL(specifier + extension, context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url)) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          fileName: fileURLToPath(url),
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const { VaultPicker } = await import("./features/vault/VaultPicker.tsx");
const { SelectField } = await import("./components/SelectField.tsx");
const { Button } = await import("./components/ui/button.tsx");
const { HostsView } = await import("./features/hosts/HostsView.tsx");
const { WindowControls } = await import("./app/WindowControls.tsx");
const { HostEditor } = await import("./features/hosts/HostEditor.tsx");
const { IdentityEditor } = await import("./features/hosts/IdentityEditor.tsx");
const { HostPasswordInput } = await import("./features/hosts/HostPasswordInput.tsx");

test("saved host password stays masked without requesting the secret during render", () => {
  let reads = 0;
  const html = renderToStaticMarkup(
    createElement(HostPasswordInput, {
      value: "",
      hasSavedPassword: true,
      onReveal: async () => {
        reads++;
        return "never-render-this-secret";
      },
      "aria-label": "Password SSH",
    }),
  );
  assert.equal(reads, 0);
  assert.match(html, /type="password"/);
  assert.match(html, /placeholder="••••••••"/);
  assert.match(html, /aria-label="Mostra password"/);
  assert.doesNotMatch(html, /never-render-this-secret| disabled(?:=""|\s|>)/);
});

test("fixed sheet actions remain associated with their validated forms", () => {
  const view = { hosts: [], identities: [], keys: [] };
  for (const [Editor, value] of [
    [
      HostEditor,
      {
        id: "new",
        name: "",
        address: "",
        port: 22,
        ownPort: null,
        groupId: "",
        identityId: "",
      },
    ],
    [
      IdentityEditor,
      {
        id: "new",
        name: "",
        username: "root",
        auth: "key",
        keyId: "",
        password: "",
      },
    ],
  ]) {
    const panel = Editor({ value, view, busy: false, error: "" });
    const form = panel.props.children;
    const submit = panel.props.footer.props.children.find(
      (child) => child?.props?.type === "submit",
    );
    assert.equal(form.type, "form");
    assert.ok(form.props.id);
    assert.equal(submit.props.form, form.props.id);
    assert.equal(typeof form.props.onSubmit, "function");
  }
});

test("discard protection covers changed endpoints, chosen identities and new passwords", () => {
  const host = {
    id: "server",
    name: "Server",
    address: "192.0.2.1",
    port: 22,
    ownPort: 22,
    groupId: "",
    identityId: "admin",
    fingerprint: "",
  };
  const identity = {
    id: "admin",
    name: "Admin",
    username: "root",
    auth: "password",
    keyId: "",
    hasPassword: true,
    hostCount: 1,
  };
  const view = {
    hosts: [host],
    identities: [identity],
    keys: [],
    groups: [],
  };
  const hostDirty = (value, currentView = view) =>
    HostEditor({ value, view: currentView }).props.dirty;
  assert.equal(hostDirty({ ...host }), false);
  assert.equal(hostDirty({ ...host, address: "192.0.2.2" }), true);
  const draft = {
    ...host,
    id: "new",
    name: "",
    address: "",
    ownPort: null,
    identityId: "",
  };
  assert.equal(hostDirty(draft), false);
  assert.equal(hostDirty({ ...draft, identityId: "chosen" }), true);
  assert.equal(hostDirty({ ...draft, identityId: "admin" }), true);
  const form = {
    id: identity.id,
    name: identity.name,
    username: identity.username,
    auth: identity.auth,
    keyId: "",
    password: "",
  };
  assert.equal(IdentityEditor({ value: form, view }).props.dirty, false);
  assert.equal(
    IdentityEditor({
      value: { ...form, password: "synthetic-new-password" },
      view,
    }).props.dirty,
    true,
  );
});

test("window controls expose accessible names and only enable inside Tauri", () => {
  const original = globalThis.isTauri;
  try {
    for (const desktop of [false, true]) {
      globalThis.isTauri = desktop;
      const html = renderToStaticMarkup(
        createElement(WindowControls, { onError() {} }),
      );
      for (const label of [
        "Riduci a icona",
        "Massimizza finestra",
        "Chiudi finestra",
      ]) {
        assert.match(html, new RegExp(`aria-label="${label}"`));
      }
      assert.equal((html.match(/<button/g) ?? []).length, 3);
      assert.equal(/ disabled(?:=""|\s|>)/.test(html), !desktop);
    }
  } finally {
    if (original === undefined) delete globalThis.isTauri;
    else globalThis.isTauri = original;
  }
});

test("vault trigger keeps its accessible name and cannot switch during pending work", () => {
  const props = {
    view: {
      vaultId: "personal",
      vaultName: "Personale",
      exists: true,
      vaults: [],
    },
    busy: false,
    disabled: false,
    onSelect() {},
    onCreate() {},
    onRename() {},
  };
  const html = renderToStaticMarkup(createElement(VaultPicker, props));
  assert.match(html, /aria-label="Vault attivo: Personale"/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.doesNotMatch(html, /<select/);
  for (const blocked of [{ busy: true }, { disabled: true }]) {
    assert.match(
      renderToStaticMarkup(
        createElement(VaultPicker, { ...props, ...blocked }),
      ),
      /disabled/,
    );
  }
});

test("custom selects keep readable labels and required form validation", () => {
  const props = {
    value: "admin",
    onValueChange() {},
    required: true,
    "aria-label": "Identità",
    options: [{ value: "admin", label: "Amministrazione — root" }],
  };
  const html = renderToStaticMarkup(createElement(SelectField, props));
  assert.match(html, /role="combobox"/);
  assert.match(html, /Amministrazione — root/);
  assert.match(html, /required/);
  const empty = renderToStaticMarkup(
    createElement(SelectField, {
      ...props,
      value: "",
      placeholder: "Scegli identità",
    }),
  );
  assert.match(empty, /Scegli identità/);
  assert.match(empty, /required/);
});

test("form actions preserve explicit submit and cancel button types", () => {
  for (const type of ["submit", "button"]) {
    assert.match(
      renderToStaticMarkup(createElement(Button, { type }, "Azione")),
      new RegExp(`type="${type}"`),
    );
  }
});

const groups = [
  { id: "work", name: "Work", parentId: "", identityId: "", port: null },
];
test("folders stay separate from root hosts in both layouts and search reveals matches", () => {
  const hosts = [
    {
      id: "a",
      name: "Grouped",
      groupId: "work",
      address: "192.0.2.1",
      port: 22,
    },
    {
      id: "b",
      name: "Standalone",
      groupId: "",
      address: "192.0.2.2",
      port: 2222,
    },
  ];
  const props = {
    hosts,
    groups,
    hostCount: () => 1,
    identities: [],
    selected: new Set(["a"]),
    busy: false,
    onOpenGroup() {},
  };
  const cards = renderToStaticMarkup(
    createElement(HostsView, { ...props, layout: "cards" }),
  );
  assert.match(cards, /Work/);
  assert.match(cards, /Standalone/);
  assert.doesNotMatch(cards, /Grouped/);
  const list = renderToStaticMarkup(
    createElement(HostsView, { ...props, layout: "list" }),
  );
  assert.doesNotMatch(list, /<details/);
  assert.match(list, /Seleziona cartella Work/);
  assert.doesNotMatch(list, /Grouped/);
  assert.match(list, /Standalone/);
  assert.match(list, /192.0.2.2:2222/);
  assert.doesNotMatch(list, /192.0.2.1:22/);
  assert.doesNotMatch(list, /type="checkbox"/);
  for (const layout of ["list", "cards"]) {
    const html = renderToStaticMarkup(
      createElement(HostsView, {
        ...props,
        layout,
        group: "work",
        hosts: [hosts[0]],
        busy: true,
      }),
    );
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /aria-label="Modifica Grouped"/);
    assert.match(html, /disabled/);
    assert.doesNotMatch(html, /192.0.2.1:22/);
    const search = renderToStaticMarkup(
      createElement(HostsView, { ...props, layout, searching: true }),
    );
    assert.match(search, /Grouped/);
    assert.match(search, /Standalone/);
  }
});

// Row and card components hold no hooks, so the tree walk can render them in place.
const rowComponents = new Set(["HostCard", "HostRow", "FolderCard"]);
const expand = (node) =>
  rowComponents.has(node.type?.name) ? node.type(node.props) : node;

test("single click selects, Ctrl and Cmd toggle, double click and Enter connect in both layouts", () => {
  const host = {
    id: "a",
    name: "Server",
    groupId: "",
    address: "192.0.2.1",
    port: 22,
  };
  const other = { ...host, id: "b", name: "Other" };
  const find = (node, label) => {
    if (!node || typeof node !== "object") return;
    if (node.props?.["aria-label"] === label) return node;
    return [expand(node).props?.children]
      .flat(Infinity)
      .map((child) => find(child, label))
      .find(Boolean);
  };
  for (const layout of ["cards", "list"]) {
    let selected = new Set(),
      connections = 0;
    const tree = (busy = false) =>
      HostsView({
        hosts: [host, other],
        groups: [],
        hostCount: () => 0,
        identities: [],
        selected,
        layout,
        busy,
        onSelect(value) {
          selected = value;
        },
        onConnect() {
          connections++;
        },
      });
    const item = (name = "Server", busy = false) =>
      find(tree(busy), "Seleziona " + name);
    item().props.onClick({});
    assert.deepEqual([...selected], ["a"]);
    assert.equal(connections, 0);
    item("Other").props.onClick({ ctrlKey: true });
    assert.deepEqual([...selected], ["a", "b"]);
    item().props.onClick({ metaKey: true });
    assert.deepEqual([...selected], ["b"]);
    item().props.onClick({});
    assert.deepEqual([...selected], ["a"]);
    item().props.onDoubleClick();
    assert.equal(connections, 1);
    const key = {
      target: 1,
      currentTarget: 1,
      key: "Enter",
      preventDefault() {},
    };
    item().props.onKeyDown(key);
    assert.equal(connections, 2);
    item("Other").props.onKeyDown({ ...key, key: " ", metaKey: true });
    assert.deepEqual([...selected], ["a", "b"]);
    item("Server", true).props.onClick({});
    item("Server", true).props.onDoubleClick();
    item("Server", true).props.onKeyDown(key);
    assert.equal(connections, 2);
    assert.equal(selected.size, 2);
  }
});

const { createPreviewBackend } = await import("./lib/preview.ts");

test("private credentials stay local and omitted passwords survive edits", async () => {
  const invoke = createPreviewBackend();
  const before = await invoke("status");
  const host = {
    ...before.hosts[0],
    id: "inline",
    name: "Inline",
    identityId: "",
  };
  for (const credentials of [
    { username: " ", password: "synthetic" },
    { username: "root", password: "" },
    { username: 123, password: "synthetic" },
  ]) {
    await assert.rejects(invoke("save_host", { host, credentials }));
    assert.deepEqual(await invoke("status"), before);
  }
  await assert.rejects(
    invoke("save_host", {
      host: { ...host, name: "" },
      credentials: { username: "root", password: "synthetic" },
    }),
  );
  assert.deepEqual(await invoke("status"), before);
  let view = await invoke("save_host", {
    host,
    credentials: { username: " deploy ", password: "synthetic-inline-secret" },
  });
  const saved = view.hosts.find((h) => h.id === host.id);
  assert.equal(saved.username, "deploy");
  assert.equal(saved.hasPassword, true);
  assert.equal(saved.identityId, "");
  assert.deepEqual(view.identities, before.identities);
  assert.ok(!JSON.stringify(view).includes("synthetic-inline-secret"));
  assert.equal(Object.hasOwn(saved, "credentials"), false);
  const beforeReveal = await invoke("status");
  assert.equal(
    await invoke("reveal_host_password", { id: host.id }),
    "password-dimostrativa",
  );
  assert.deepEqual(await invoke("status"), beforeReveal);
  await assert.rejects(
    invoke("reveal_host_password", { id: host.id, vaultId: "other" }),
  );
  await assert.rejects(invoke("reveal_host_password", { id: "missing" }));
  view = await invoke("save_host", {
    host: saved,
    credentials: { username: "admin", password: "" },
  });
  assert.equal(view.hosts.find((h) => h.id === host.id).hasPassword, true);
  assert.equal(view.hosts.find((h) => h.id === host.id).username, "admin");
  assert.deepEqual(
    view.hosts.filter((h) => h.id !== host.id),
    before.hosts,
  );
  view = await invoke("assign_identity", {
    ids: [host.id],
    identityId: before.identities[0].id,
  });
  assert.equal(view.hosts.find((h) => h.id === host.id).hasPassword, false);
  await assert.rejects(invoke("reveal_host_password", { id: host.id }));
  await assert.rejects(
    invoke("save_host", {
      host,
      credentials: { username: "root", password: "" },
    }),
  );
});

const { hostDraftIsDirty, hostDraftIsValid } = await import("./features/hosts/host-draft.ts");
test("draft validation requires its own password or an explicit shared identity", () => {
  const host = {
    id: "a",
    name: "API",
    address: "192.0.2.1",
    port: 22,
    ownPort: 22,
    groupId: "",
    identityId: "",
    username: "root",
    hasPassword: true,
  };
  assert.equal(hostDraftIsDirty(host, host), false);
  assert.equal(hostDraftIsValid(host, [], host), true);
  assert.equal(hostDraftIsValid(host, []), false);
  assert.equal(
    hostDraftIsValid(host, [], { ...host, identityId: "shared" }),
    false,
  );
  assert.equal(hostDraftIsValid({ ...host, name: "" }, [], host), false);
  assert.equal(
    hostDraftIsValid({ ...host, address: "https://example.test" }, [], host),
    false,
  );
  assert.equal(
    hostDraftIsValid(
      { ...host, credentials: { username: "bad user", password: "secret" } },
      [],
    ),
    false,
  );
  assert.equal(
    hostDraftIsValid({ ...host, identityId: "shared" }, [{ id: "shared" }]),
    true,
  );
  assert.equal(
    hostDraftIsDirty(
      { ...host, credentials: { username: "root", password: "new-secret" } },
      host,
    ),
    true,
  );
});

test("preview CRUD uses isolated snapshots, preserves references and discards secrets", async () => {
  const invoke = createPreviewBackend();
  let view = await invoke("status");
  const host = { ...view.hosts[0], name: "Host modificato" };
  view.hosts[0].name = "Mutazione esterna";
  assert.notEqual((await invoke("status")).hosts[0].name, "Mutazione esterna");
  view = await invoke("save_host", { host });
  assert.equal(view.hosts.find((h) => h.id === host.id).name, host.name);
  const identity = {
    id: "demo-login",
    name: "Test",
    username: "root",
    auth: "password",
    keyId: "",
    password: "password-fittizia",
  };
  view = await invoke("save_identity", { identity });
  view = await invoke("assign_identity", {
    ids: [host.id],
    identityId: identity.id,
  });
  assert.equal(view.identities.find((i) => i.id === identity.id).hostCount, 1);
  assert.equal(
    view.identities.find((i) => i.id === host.identityId).hostCount,
    19,
  );
  await assert.rejects(invoke("delete_identity", { id: identity.id }));
  await assert.rejects(invoke("delete_key", { id: "key-personal" }));
  await assert.rejects(
    invoke("save_host", { host: { ...host, identityId: "missing" } }),
  );
  await assert.rejects(
    invoke("assign_identity", {
      ids: [host.id, "missing"],
      identityId: host.identityId,
    }),
  );
  assert.equal(
    (await invoke("status")).hosts.find((h) => h.id === host.id).identityId,
    identity.id,
  );
  view = await invoke("save_identity", {
    identity: { ...identity, password: "", name: "Rinominata" },
  });
  assert.equal(
    view.identities.find((i) => i.id === identity.id).hasPassword,
    true,
  );
  view = await invoke("save_key", {
    key: {
      id: "demo-key",
      name: "Fittizia",
      privateKey: "chiave-fittizia",
      passphrase: "passphrase-fittizia",
    },
  });
  assert.match(
    view.keys.find((k) => k.id === "demo-key").fingerprint,
    /non verificata/,
  );
  view = await invoke("save_key", {
    key: { id: "demo-key", name: "Rinominata", privateKey: "" },
  });
  assert.equal(view.keys.find((k) => k.id === "demo-key").name, "Rinominata");
  view = await invoke("configure_sync", {
    url: "https://example.test/vault",
    token: "token-fittizio".repeat(3),
  });
  assert.equal(view.syncConfigured, true);
  for (const secret of [
    identity.password,
    "chiave-fittizia",
    "passphrase-fittizia",
    "token-fittizio",
  ])
    assert.ok(!JSON.stringify(view).includes(secret));
  await assert.rejects(invoke("sync_vault"), /desktop/);
  await assert.rejects(invoke("connect"), /desktop/);
  await invoke("delete_host", { id: host.id });
  view = await invoke("delete_identity", { id: identity.id });
  assert.ok(!view.identities.some((i) => i.id === identity.id));
  view = await invoke("delete_key", { id: "demo-key" });
  assert.ok(!view.keys.some((k) => k.id === "demo-key"));
  assert.equal((await createPreviewBackend()("status")).hosts.length, 34);
});

test("preview vaults switch, lock and unlock without losing or mixing data", async () => {
  const invoke = createPreviewBackend();
  let view = await invoke("create_vault", { name: "Lavoro" });
  const vaultId = view.vaultId;
  assert.equal(view.unlocked, false);
  assert.equal(view.hosts.length, 0);
  await assert.rejects(invoke("save_key", { key: { id: "test" } }), /Sblocca/);
  view = await invoke("unlock", {
    password: "password-fittizia",
    create: true,
  });
  assert.equal(view.unlocked, true);
  view = await invoke("rename_vault", { name: "Test" });
  assert.equal(view.vaultName, "Test");
  await assert.rejects(invoke("status", { vaultId: "personal" }), /non attivo/);
  view = await invoke("select_vault", { vaultId: "personal" });
  assert.equal(view.hosts.length, 34);
  view = await invoke("lock");
  assert.equal(view.hosts.length, 0);
  view = await invoke("unlock", { password: "fittizia" });
  assert.equal(view.hosts.length, 34);
  view = await invoke("select_vault", { vaultId });
  assert.equal(view.hosts.length, 0);
  assert.equal(view.vaultName, "Test");
});

const { selectionBounds, selectInRectangle } =
  await import("./features/hosts/CollectionSelection.tsx");
const { HostSummary } = await import("./features/hosts/HostSummary.tsx");

test("rectangle selection works in every direction, intersects items and keeps folders out of host actions", () => {
  const bounds = selectionBounds({ x: 100, y: 100 }, { x: 10, y: 10 });
  assert.deepEqual(bounds, { left: 10, top: 10, right: 100, bottom: 100 });
  const initial = { hosts: new Set(["earlier"]), folders: new Set() };
  const result = selectInRectangle(
    bounds,
    [
      {
        id: "host",
        folder: false,
        rect: { left: 0, top: 0, right: 20, bottom: 20 },
      },
      {
        id: "folder",
        folder: true,
        rect: { left: 30, top: 30, right: 40, bottom: 40 },
      },
      {
        id: "outside",
        folder: false,
        rect: { left: 100, top: 30, right: 130, bottom: 50 },
      },
    ],
    initial,
  );
  assert.deepEqual([...result.hosts], ["earlier", "host"]);
  assert.deepEqual([...result.folders], ["folder"]);
  assert.deepEqual([...initial.hosts], ["earlier"]);
  assert.equal(initial.folders.size, 0);
});

test("folder click selects, Ctrl toggles, double click and Enter open in both layouts", () => {
  const find = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.props?.["aria-label"] === "Seleziona cartella Work") return node;
    return [expand(node).props?.children]
      .flat(Infinity)
      .map(find)
      .find(Boolean);
  };
  for (const layout of ["cards", "list"]) {
    let folders = new Set(),
      hosts = new Set(["a"]),
      opened = 0;
    const item = (busy = false) =>
      find(
        HostsView({
          hosts: [{ id: "a", name: "Server", groupId: "work" }],
          groups,
          hostCount: () => 1,
          identities: [],
          selected: hosts,
          selectedFolders: folders,
          layout,
          busy,
          onSelect(value) {
            hosts = value;
          },
          onSelectFolders(value) {
            folders = value;
          },
          onOpenGroup(id) {
            assert.equal(id, "work");
            opened++;
          },
        }),
      );
    item().props.onClick({});
    assert.deepEqual([...folders], ["work"]);
    assert.equal(hosts.size, 0);
    assert.equal(opened, 0);
    item().props.onClick({ ctrlKey: true });
    assert.equal(folders.size, 0);
    item().props.onKeyDown({ key: " ", preventDefault() {} });
    assert.deepEqual([...folders], ["work"]);
    item().props.onDoubleClick();
    item().props.onKeyDown({ key: "Enter", preventDefault() {} });
    assert.equal(opened, 2);
    item(true).props.onClick({ metaKey: true });
    item(true).props.onDoubleClick();
    assert.equal(opened, 2);
    assert.deepEqual([...folders], ["work"]);
  }
});

test("bulk summaries identify every affected host with its login and nondefault port", () => {
  const html = renderToStaticMarkup(
    createElement(HostSummary, {
      hosts: [
        {
          id: "a",
          name: "API <prod>",
          address: "192.0.2.1",
          port: 22,
          identityId: "login",
        },
        {
          id: "b",
          name: "Database",
          address: "192.0.2.2",
          port: 2222,
          identityId: "missing",
        },
      ],
      identities: [{ id: "login", username: "deploy" }],
    }),
  );
  assert.match(html, /API &lt;prod&gt;/);
  assert.match(html, /deploy@/);
  assert.match(html, /192.0.2.1/);
  assert.doesNotMatch(html, /192.0.2.1:22/);
  assert.match(html, /192.0.2.2/);
  assert.match(html, /:2222/);
  assert.equal((html.match(/<li[ >]/g) ?? []).length, 2);
});

test("identity and key tables disable deletion while in use", async () => {
  const { IdentitiesTable, KeysTable } = await import("./features/hosts/CollectionTables.tsx");
  const btn = (html, name) =>
    html.match(new RegExp(`<button[^>]*aria-label="Elimina ${name}"[^>]*>`))[0];
  const noop = () => {};
  const shared = { busy: false, onEdit: noop, onDelete: noop, onUsage: noop };
  const keys = [
    {
      id: "k",
      name: "Chiave",
      fingerprint: "",
      identityCount: 1,
      hostCount: 2,
    },
  ];
  const identities = [
    {
      id: "i1",
      name: "Usata",
      username: "root",
      auth: "key",
      keyId: "k",
      hostCount: 3,
    },
    {
      id: "i2",
      name: "Libera",
      username: "deploy",
      auth: "password",
      hostCount: 0,
    },
  ];
  const ih = renderToStaticMarkup(
    createElement(IdentitiesTable, { ...shared, identities, keys }),
  );
  assert.ok(btn(ih, "Usata").includes('disabled=""'));
  assert.ok(!btn(ih, "Libera").includes('disabled=""'));
  assert.match(ih, /Chiave/);
  const kh = renderToStaticMarkup(
    createElement(KeysTable, { ...shared, keys, identities }),
  );
  assert.ok(btn(kh, "Chiave").includes('disabled=""'));
  assert.match(kh, /Da verificare/);
});
