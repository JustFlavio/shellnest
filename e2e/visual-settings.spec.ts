import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
});

const stored = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("shellnest.settings") ?? "{}"),
  );

test("terminal settings persist and apply", async ({ page }) => {
  await page.getByRole("tab", { name: "Terminale" }).click();
  await page.getByRole("button", { name: "Ingrandisci testo" }).click();
  await page.getByRole("radio", { name: "Nord" }).click();
  await page.getByRole("switch", { name: "Suono del bell" }).click();
  await page.getByLabel("Righe di scrollback").fill("9000");
  expect(await stored(page)).toMatchObject({
    fontSize: 14,
    terminalTheme: "nord",
    bell: true,
    scrollback: 9000,
  });
  await expect(
    page.getByRole("switch", { name: "Suono del bell" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("appearance settings persist and repaint the interface", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("radio", { name: "Chiaro" }).click();
  await page.getByRole("radio", { name: "Fjord" }).click();
  expect(await stored(page)).toMatchObject({
    colorScheme: "light",
    appTheme: "fjord",
  });
  const root = page.locator("html");
  await expect(root).toHaveCSS("color-scheme", "light");
  await expect(root).toHaveCSS("background-color", "rgb(246, 248, 251)");
});

test("the default vault cannot be deleted, an empty new one can", async ({
  page,
}) => {
  await page
    .getByRole("tablist", { name: "Sezioni delle impostazioni" })
    .getByRole("tab", { name: "Vault" })
    .click();
  await expect(
    page.getByRole("button", { name: "Elimina “Personal”" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Nuovo vault" }).click();
  await page.getByPlaceholder(/Personale, Lavoro/).fill("Lavoro");
  await page.getByRole("button", { name: /^Crea/ }).click();
  await page.getByLabel("Password principale").fill("password-di-prova-123");
  await page.getByLabel("Conferma password").fill("password-di-prova-123");
  await page.getByRole("button", { name: "Crea vault", exact: true }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await expect(page.getByRole("heading", { name: "Impostazioni" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page
    .getByRole("tablist", { name: "Sezioni delle impostazioni" })
    .getByRole("tab", { name: "Vault" })
    .click();
  const remove = page.getByRole("button", { name: "Elimina “Lavoro”" });
  await expect(remove).toBeEnabled();
  await remove.click();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await page.getByRole("button", { name: "Menu applicazione" }).waitFor();
  await expect(page.getByText("Personal").first()).toBeVisible();
});
