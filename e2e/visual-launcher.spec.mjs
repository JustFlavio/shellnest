import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const search = (page) =>
  page.getByRole("combobox", { name: "Cerca host o schede" });
const card = (page) =>
  page.getByRole("heading", { name: "Connessione rapida" });

async function openLauncher(page) {
  await page.keyboard.press("Meta+t");
  await search(page).waitFor();
}

test("a host with an open tab is one row that switches to it", async ({
  page,
}) => {
  await openLauncher(page);
  await page.getByRole("option", { name: /api-01/ }).click();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
  await search(page).fill("api-01");
  const rows = page.getByRole("option");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("aperta");
  await expect(
    page.getByRole("button", { name: "Nuova sessione api-01" }),
  ).toBeAttached();
  await rows.click();
  await expect(search(page)).toHaveCount(0);
  await expect(page.locator(".xterm")).toHaveCount(1);
});

test("a new session of an open host opens a second tab", async ({ page }) => {
  await openLauncher(page);
  await page.getByRole("option", { name: /api-01/ }).click();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
  await search(page).fill("api-01");
  await page
    .getByRole("button", { name: "Nuova sessione api-01" })
    .click({ force: true });
  await expect(page.locator(".xterm")).toHaveCount(2);
});

test("a bare word never offers a quick connection", async ({ page }) => {
  await openLauncher(page);
  await search(page).fill("rc");
  await expect(card(page)).toHaveCount(0);
});

test("targets offer a quick connection", async ({ page }) => {
  await openLauncher(page);
  await search(page).fill("root@1.2.3.4");
  await expect(card(page)).toBeVisible();
  await expect(page.locator("form code")).toHaveText("root@1.2.3.4:22");
  await search(page).fill("10.0.0.5:2222");
  await expect(page.locator("form code")).toHaveText("10.0.0.5:2222");
});

test("Cmd+Enter reveals the quick connection and focuses the identity", async ({
  page,
}) => {
  await openLauncher(page);
  await search(page).fill("rc");
  await search(page).press("Meta+Enter");
  await expect(card(page)).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Identità per connessione rapida" }),
  ).toBeFocused();
});

test("an empty vault explains how to connect", async ({ page }) => {
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page.getByRole("button", { name: "Nuovo vault" }).click();
  await page.getByPlaceholder(/Personale, Lavoro/).fill("Vuoto");
  await page.getByRole("button", { name: /^Crea/ }).click();
  await page.getByLabel("Password principale").fill("password-di-prova-123");
  await page.getByLabel("Conferma password").fill("password-di-prova-123");
  await page.getByRole("button", { name: "Crea vault", exact: true }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await openLauncher(page);
  await search(page).fill("rc");
  await expect(
    page.getByText(/Invio per una connessione rapida/),
  ).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});
