import assert from "node:assert/strict";
import { browser, $ } from "@wdio/globals";
import { generateKeyPairSync } from "node:crypto";
import { join } from "node:path";

const password = "synthetic-e2e-password";
async function screenshot(name: string) {
  await browser.execute(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await browser.saveScreenshot(
    join(process.cwd(), `artifacts/desktop-e2e/${name}.png`),
  );
}

// macOS keeps the app menu in the native menu bar, out of WebDriver's reach; its items have
// the same shortcuts in the page. WebDriver key codes: Command, Shift.
const COMMAND = "\uE03D";
const SHIFT = "\uE008";
async function appMenu(item: string, shortcut: string[]) {
  const menu = $('[aria-label="Menu applicazione"]');
  if (await menu.isExisting()) {
    await menu.click();
    await $(`[role="menuitem"]*=${item}`).click();
  } else {
    // shortcuts are ignored until the vault is open
    await $("button=Nuovo host").waitForDisplayed();
    await browser.keys(shortcut);
  }
}

// The part of the app state this test reads.
type State = {
  identities: { id: string }[];
  hosts: {
    name: string;
    identityId: string;
    tags: string[];
    keyId?: string;
    hasPassword: boolean;
  }[];
};

describe("Tauri desktop with an isolated real vault", () => {
  it("creates hosts, reuses an identity, switches layout and unlocks persisted data", async () => {
    // The selectors below read the Italian interface, whatever the language of the machine.
    await browser.execute(() =>
      localStorage.setItem(
        "shellnest.settings",
        JSON.stringify({ language: "it" }),
      ),
    );
    await browser.refresh();
    const master = await $(
      "//label[contains(., 'Password principale')]//input",
    );
    await master.waitForDisplayed();
    await master.setValue(password);
    await $("//label[contains(., 'Conferma password')]//input").setValue(
      password,
    );
    await $(
      '[role="switch"][aria-label="Ricorda su questo dispositivo"]',
    ).click();
    await $("button=Crea vault").click();

    await appMenu("Impostazioni", [COMMAND, ","]);
    await $(
      '[aria-label="Sezioni delle impostazioni"] [role="tab"][aria-selected="true"]',
    ).waitForDisplayed();
    assert.equal(
      await $(
        '[aria-label="Sezioni delle impostazioni"] [role="tab"][aria-selected="true"]',
      ).getText(),
      "Generale",
    );
    await $(
      '[aria-label="Sezioni delle impostazioni"] [role="tab"]:nth-child(2)',
    ).click();
    await $('[aria-label="Chiudi pannello"]').click();
    await appMenu("Impostazioni", [COMMAND, ","]);
    assert.equal(
      await $(
        '[aria-label="Sezioni delle impostazioni"] [role="tab"][aria-selected="true"]',
      ).getText(),
      "Generale",
    );
    await screenshot("settings");
    await $('[aria-label="Chiudi pannello"]').click();
    assert.equal(
      await $("[data-app-header] svg.lucide-cloud").isExisting(),
      false,
    );
    assert.equal(await $("button=Connessione rapida").isExisting(), false);
    assert.equal(await $("button=Terminale locale").isExisting(), false);
    await $("button=Terminale").waitForDisplayed();

    await $('[aria-label="Identità"]').click();
    await $("button=Nuova identità").click();
    await $('[placeholder="Es. Amministrazione"]').setValue("E2E Login");
    await $('[aria-label="Metodo di autenticazione"]').click();
    await $('[role="option"]=Password').click();
    await $('#identity-editor-form input[type="password"]').setValue(
      "synthetic-ssh-password",
    );
    await $("button=Salva identità").click();
    await $('[aria-label="Modifica E2E Login"]').waitForDisplayed();
    await $('[aria-label="Host"]').click();

    const newHost = () => $("button=Nuovo host");
    await newHost().waitForDisplayed();
    await newHost().click();
    await browser.waitUntil(
      async () =>
        await browser.execute(
          () =>
            document.activeElement?.getAttribute("placeholder") ===
            "IP o nome host",
        ),
    );
    await $('[placeholder="IP o nome host"]').setValue("192.0.2.10");
    await $('[placeholder="Nome dell’host"]').setValue("E2E Alpha");
    await $('[aria-label="Tag"]').setValue("production");
    await $('[role="option"]*=Crea tag').waitForDisplayed();
    await browser.keys("Enter");
    await $('[role="combobox"][aria-label="Utente SSH"]').setValue("root");
    await $('[role="option"]*=E2E Login').waitForDisplayed();
    await $('[role="option"]*=E2E Login').click();
    await $('[role="status"][data-status="saved"]').waitForDisplayed();
    assert.equal(await $("button=Crea identità condivisa").isExisting(), false);
    await screenshot("host-editor");
    await $('[aria-label="Chiudi pannello"]').click();
    await $('[aria-label="Seleziona E2E Alpha"]').waitForDisplayed();

    await newHost().click();
    await $('[placeholder="IP o nome host"]').setValue("192.0.2.11");
    await $('[placeholder="Nome dell’host"]').setValue("E2E Beta");
    const tagged = (await browser.tauri.execute(({ core }) =>
      core.invoke("status"),
    )) as State;
    assert.ok(tagged.hosts[0].tags.includes("production"));
    await $('[aria-label="Tag"]').click();
    await $('[aria-label="Tag"]').setValue("prod");
    await $('[role="option"]=production').waitForDisplayed();
    await $('[role="option"]=production').click();
    await $('[role="combobox"][aria-label="Utente SSH"]').setValue("root");
    await $('[role="option"]*=E2E Login').waitForDisplayed();
    await $('[role="option"]*=E2E Login').click();
    await $('[role="status"][data-status="saved"]').waitForDisplayed();
    await $('[aria-label="Chiudi pannello"]').click();
    await $('[aria-label="Seleziona E2E Beta"]').waitForDisplayed();

    const { privateKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const key = {
      id: "e2e-key",
      name: "E2E key",
      privateKey: privateKey,
      passphrase: "",
      fingerprint: "",
    };
    await browser.tauri.execute(
      ({ core }, key) => core.invoke("save_key", { vaultId: "personal", key }),
      key,
    );
    await appMenu("Blocca vault", [COMMAND, SHIFT, "l"]);
    await $("button=Sblocca").waitForDisplayed();
    await $("//label[contains(., 'Password principale')]//input").setValue(
      password,
    );
    await $("button=Sblocca").click();
    await newHost().waitForDisplayed();
    await newHost().click();
    await $('[placeholder="IP o nome host"]').setValue("192.0.2.12");
    await $('[placeholder="Nome dell’host"]').setValue("E2E Direct key");
    await $('[aria-label="Utente SSH"]').setValue("deploy");
    await browser.keys("Escape");
    await $("button*=Identità o chiave SSH").click();
    await $('[role="menuitem"]=Chiave SSH').click();
    assert.equal(await $('[aria-label="Password SSH"]').isExisting(), false);
    await $('[aria-label="Chiave"]').setValue("E2E");
    await $('[role="option"]=E2E key').waitForDisplayed();
    await $('[role="option"]=E2E key').click();
    await $('[role="status"][data-status="saved"]').waitForDisplayed();
    await screenshot("host-key");
    await $('[aria-label="Chiudi pannello"]').click();

    await $('[aria-label="Lista"]').click();
    await $("table").waitForDisplayed();
    assert.equal(
      await $("table")
        .getText()
        .then((text) => text.includes("E2E Alpha")),
      true,
    );
    assert.equal(
      await $("table")
        .getText()
        .then((text) => text.includes("E2E Beta")),
      true,
    );
    await $('[aria-label="Schede"]').click();
    await browser.waitUntil(async () => !(await $("table").isExisting()));

    await $('[aria-label="Identità"]').click();
    await $('[aria-label="Modifica E2E Login"]').waitForDisplayed();
    const state = (await browser.tauri.execute(({ core }) =>
      core.invoke("status"),
    )) as State;
    assert.equal(state.identities.length, 1);
    assert.equal(state.hosts.length, 3);
    assert.ok(
      state.hosts
        .filter((host) => host.name !== "E2E Direct key")
        .every(
          (host) =>
            host.identityId === state.identities[0].id &&
            host.tags.includes("production"),
        ),
    );
    await $('[aria-label="Host"]').click();

    await appMenu("Blocca vault", [COMMAND, SHIFT, "l"]);
    await $("button=Sblocca").waitForDisplayed();
    await $("//label[contains(., 'Password principale')]//input").setValue(
      password,
    );
    await $("button=Sblocca").click();
    await $('[aria-label="Seleziona E2E Alpha"]').waitForDisplayed();
    await $('[aria-label="Seleziona E2E Beta"]').waitForDisplayed();
    const restored = (await browser.tauri.execute(({ core }) =>
      core.invoke("status"),
    )) as State;
    const direct = restored.hosts.find(
      (host) => host.name === "E2E Direct key",
    )!;
    assert.equal(direct.keyId, key.id);
    assert.equal(direct.identityId, "");
    assert.equal(direct.hasPassword, false);
  });

  it("signs up on a sync server, uploads the vault and follows a password change", async () => {
    const server = process.env.SHELLNEST_E2E_SYNC_URL!;
    const accountPassword = "synthetic-account-password";
    const newPassword = "synthetic-account-password-2";
    const shown = (text: string) =>
      browser.waitUntil(
        () => browser.execute((t) => document.body.innerText.includes(t), text),
        { timeoutMsg: `"${text}" not shown` },
      );
    const field = (form: string, label: string) =>
      $(`//form[@id='${form}']//label[contains(., '${label}')]//input`);

    await appMenu("Impostazioni", [COMMAND, ","]);
    await $('[role="tab"]=Vault').click();
    await $("button=Carica sul server").waitForDisplayed();
    assert.equal(await $("button=Carica sul server").isEnabled(), false);
    await $("button=Ho un invito").click();
    const form = "account-dialog-form";
    await field(form, "Server").setValue(server);
    await field(form, "Codice di invito").setValue(
      process.env.SHELLNEST_E2E_INVITE!,
    );
    await field(form, "Nome utente").setValue("mario");
    await field(form, "Nuova password").setValue(accountPassword);
    await field(form, "Conferma password").setValue(accountPassword);
    await $(`#${form} button[type="submit"]`).click();

    await $('[role="switch"][aria-label="L’ho salvata"]').waitForDisplayed();
    const recovery = await $("code").getText();
    assert.equal(recovery.split("-").length, 8);
    await $('[role="switch"][aria-label="L’ho salvata"]').click();
    await $("button=Fatto").click();
    await shown(`mario su ${server}`);

    await $("button=Carica sul server").click();
    await $("button=Sincronizza ora").waitForDisplayed();
    await shown("Proprietario");
    await screenshot("server-vault");

    // The server keeps only ciphertext: no host name or address in clear.
    const { readdir, readFile } = await import("node:fs/promises");
    const root = join(process.env.SHELLNEST_E2E_DATA_DIR!, "sync-server");
    const files = (await readdir(root, { recursive: true })).map((f) =>
      join(root, f),
    );
    for (const file of files) {
      const text = await readFile(file, "utf8").catch(() => "");
      for (const clear of ["E2E Alpha", "192.0.2.10", "synthetic-ssh"])
        assert.ok(!text.includes(clear), `${clear} in ${file}`);
    }

    await $("button=Dispositivi").click();
    await shown("questo dispositivo");
    // The devices panel sits over the settings: close the topmost one.
    await $("(//*[@aria-label='Chiudi pannello'])[last()]").click();
    await $("button=Cambia password").waitForDisplayed();

    await $("button=Cambia password").click();
    await $("//label[contains(., 'Password attuale')]//input").setValue(
      accountPassword,
    );
    await $("//label[contains(., 'Nuova password')]//input").setValue(
      newPassword,
    );
    await $("//label[contains(., 'Conferma password')]//input").setValue(
      newPassword,
    );
    await $(
      "//form//button[@type='submit' and normalize-space()='Cambia password']",
    ).click();
    await browser.waitUntil(
      async () =>
        !(await $("//label[contains(., 'Password attuale')]").isExisting()),
    );

    await $("button=Invita").click();
    await shown("Vale una volta, per 7 giorni");
    await $("button=Fatto").click();
    await $('[aria-label="Chiudi pannello"]').click();

    // The vault now opens with the account password: the new one, not the old.
    await appMenu("Blocca vault", [COMMAND, SHIFT, "l"]);
    const unlock = $("//label[contains(., 'Password dell’account')]//input");
    await unlock.waitForDisplayed();
    await unlock.setValue(accountPassword);
    await $("button=Sblocca").click();
    await $('[role="alert"]').waitForDisplayed();
    await unlock.clearValue();
    await unlock.setValue(newPassword);
    await $("button=Sblocca").click();
    await $('[aria-label="Seleziona E2E Alpha"]').waitForDisplayed();
    const state = (await browser.tauri.execute(({ core }) =>
      core.invoke("status"),
    )) as State;
    assert.equal(state.hosts.length, 3);
  });
});
