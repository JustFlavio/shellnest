import assert from "node:assert/strict";
import { browser, $ } from "@wdio/globals";

const password = "synthetic-e2e-password";

// The part of the app state this test reads.
type State = {
  identities: { id: string }[];
  hosts: { identityId: string }[];
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
    const master = await $("//label[contains(., 'Password principale')]/input");
    await master.waitForDisplayed();
    await master.setValue(password);
    await $("//label[contains(., 'Conferma password')]/input").setValue(
      password,
    );
    await $("button=Crea vault").click();

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

    const newHost = await $("button=Nuovo host");
    await newHost.waitForDisplayed();
    await newHost.click();
    await $('[placeholder="IP o nome host"]').setValue("192.0.2.10");
    await $('[placeholder="Nome dell’host"]').setValue("E2E Alpha");
    await $('[role="combobox"][aria-label="Utente SSH"]').setValue("root");
    await $('[role="option"]*=E2E Login').waitForDisplayed();
    await $('[role="option"]*=E2E Login').click();
    await $(".sheet-save-state.saved").waitForDisplayed();
    await $('[aria-label="Chiudi pannello"]').click();
    await $('[aria-label="Seleziona E2E Alpha"]').waitForDisplayed();

    await newHost.click();
    await $('[placeholder="IP o nome host"]').setValue("192.0.2.11");
    await $('[placeholder="Nome dell’host"]').setValue("E2E Beta");
    await $('[role="combobox"][aria-label="Utente SSH"]').setValue("root");
    await $('[role="option"]*=E2E Login').waitForDisplayed();
    await $('[role="option"]*=E2E Login').click();
    await $(".sheet-save-state.saved").waitForDisplayed();
    await $('[aria-label="Chiudi pannello"]').click();
    await $('[aria-label="Seleziona E2E Beta"]').waitForDisplayed();

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
    assert.equal(state.hosts.length, 2);
    assert.ok(
      state.hosts.every((host) => host.identityId === state.identities[0].id),
    );
    await $('[aria-label="Host"]').click();

    await $('[aria-label="Menu applicazione"]').click();
    await $('[role="menuitem"]*=Blocca vault').click();
    await $("button=Sblocca").waitForDisplayed();
    await $("//label[contains(., 'Password principale')]/input").setValue(
      password,
    );
    await $("button=Sblocca").click();
    await $('[aria-label="Seleziona E2E Alpha"]').waitForDisplayed();
    await $('[aria-label="Seleziona E2E Beta"]').waitForDisplayed();
  });
});
