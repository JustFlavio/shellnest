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

    await $('[aria-label="Menu applicazione"]').click();
    await $('[role="menuitem"]*=Impostazioni').click();
    await $(
      '[aria-label="Sezioni delle impostazioni"] button[aria-current="page"]',
    ).waitForDisplayed();
    assert.equal(
      await $(
        '[aria-label="Sezioni delle impostazioni"] button[aria-current="page"]',
      ).getText(),
      "Generale",
    );
    await $(
      '[aria-label="Sezioni delle impostazioni"] button:nth-child(2)',
    ).click();
    await $('[aria-label="Chiudi pannello"]').click();
    await $('[aria-label="Menu applicazione"]').click();
    await $('[role="menuitem"]*=Impostazioni').click();
    assert.equal(
      await $(
        '[aria-label="Sezioni delle impostazioni"] button[aria-current="page"]',
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
    await $('[role="status"][title="Salvato"]').waitForDisplayed();
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
    await $('[role="status"][title="Salvato"]').waitForDisplayed();
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
    await $('[aria-label="Menu applicazione"]').click();
    await $('[role="menuitem"]*=Blocca vault').click();
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
    await $("button*=Identità o chiave SSH").click();
    await $('[role="menuitem"]=Chiave SSH').click();
    assert.equal(await $('[aria-label="Password SSH"]').isExisting(), false);
    await $('[aria-label="Chiave"]').click();
    await $('[role="option"]=E2E key').waitForDisplayed();
    await $('[role="option"]=E2E key').click();
    await $('[role="status"][title="Salvato"]').waitForDisplayed();
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

    await $('[aria-label="Menu applicazione"]').click();
    await $('[role="menuitem"]*=Blocca vault').click();
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
});
