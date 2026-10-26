import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const shot = (page, name) =>
  expect(page).toHaveScreenshot(name + ".png", { fullPage: false });

test("hosts as cards", async ({ page }) => {
  await shot(page, "hosts-cards");
});

test("hosts as list", async ({ page }) => {
  await page.getByRole("button", { name: "Lista" }).click();
  await shot(page, "hosts-list");
});

test("new-host menu", async ({ page }) => {
  await page.getByRole("button", { name: "Altre azioni di creazione" }).click();
  await page.getByRole("menuitem", { name: /Nuova cartella/ }).waitFor();
  await shot(page, "new-host-menu");
});

test("identities and keys", async ({ page }) => {
  await page.getByRole("button", { name: "Identità" }).first().click();
  await page.getByRole("heading", { name: "Identità", level: 1 }).waitFor();
  await shot(page, "identities");
  await page.getByRole("button", { name: "Chiavi SSH" }).first().click();
  await page.getByRole("heading", { name: "Chiavi SSH", level: 1 }).waitFor();
  await shot(page, "keys");
});

test("host editor and discard dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: /host/i }).first().waitFor();
  await shot(page, "host-editor");
  await page.getByRole("textbox").first().fill("prova");
  await page.getByRole("button", { name: "Chiudi pannello" }).click();
  await page.getByRole("heading", { name: "Scartare le modifiche?" }).waitFor();
  await shot(page, "discard-dialog");
});

test("quick connect launcher", async ({ page }) => {
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await page.getByRole("combobox", { name: "Cerca host o schede" }).waitFor();
  await shot(page, "launcher");
});
