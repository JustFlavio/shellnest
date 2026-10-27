import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const toasts = (page: Page) => page.locator("[data-sonner-toast]");
// `update` picks what the preview updater finds (src/lib/preview/updater.ts).
const explore = async (page: Page, update: string) => {
  await page.clock.install();
  await page.goto(`/?update=${update}`);
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
};
const checkFromMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: "Controlla aggiornamenti" }).click();
};
const relaunched = (page: Page) => page.evaluate(() => window.__relaunched);

test("a manual check finds an update, downloads it and restarts only on the click", async ({
  page,
}) => {
  await explore(page, "available");
  await checkFromMenu(page);
  const toast = toasts(page);
  await expect(toast).toContainText("Aggiornamento disponibile");
  await expect(toast).toContainText("9.9.9");
  await toast.getByRole("button", { name: "Scarica" }).click();
  await expect(toast).toContainText("Aggiornamento pronto");
  expect(await relaunched(page)).toBeFalsy();
  await toast.getByRole("button", { name: "Riavvia ora" }).click();
  await expect.poll(() => relaunched(page)).toBe(true);
});

test("the download toast shows progress until it finishes", async ({
  page,
}) => {
  await explore(page, "hold");
  await checkFromMenu(page);
  await toasts(page).getByRole("button", { name: "Scarica" }).click();
  const bar = toasts(page).getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-valuenow", "40");
  await expect(toasts(page)).toContainText("40%");
  await page.evaluate(() => window.__releaseUpdate?.());
  await expect(toasts(page)).toContainText("Aggiornamento pronto");
  await expect(bar).toHaveCount(0);
});

test("a manual check with nothing new says so", async ({ page }) => {
  await explore(page, "none");
  await checkFromMenu(page);
  await expect(toasts(page)).toContainText("Nessun aggiornamento");
});

test("a manual check that fails says why, with a retry", async ({ page }) => {
  await explore(page, "error");
  await checkFromMenu(page);
  await expect(toasts(page)).toContainText(
    "Controllo non riuscito: Errore simulato in check",
  );
  await expect(
    toasts(page).getByRole("button", { name: "Riprova" }),
  ).toBeVisible();
});

test("the launch check announces an update after five seconds", async ({
  page,
}) => {
  await explore(page, "available");
  await page.clock.fastForward(4000);
  await expect(toasts(page)).toHaveCount(0);
  await page.clock.fastForward(1500);
  await expect(toasts(page)).toContainText("Aggiornamento disponibile");
});

test("a failing launch check stays quiet", async ({ page }) => {
  await explore(page, "error");
  await page.clock.fastForward(6000);
  await page.clock.runFor(500);
  await expect(toasts(page)).toHaveCount(0);
});

test("the launch check can be turned off in the settings", async ({ page }) => {
  await explore(page, "available");
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page.getByRole("button", { name: "Aggiornamenti" }).click();
  await page.getByRole("switch", { name: "Controlla all’avvio" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("shellnest.settings") ?? "{}")
          .checkUpdates,
    ),
  ).toBe(false);
  await page.clock.fastForward(6000);
  await expect(toasts(page)).toHaveCount(0);
});

test("the settings card shows the version and checks on demand", async ({
  page,
}) => {
  await explore(page, "available");
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page.getByRole("button", { name: "Aggiornamenti" }).click();
  const card = page.locator("section", { hasText: "Versione installata" });
  await expect(card).toContainText("Shellnest 0.1.0");
  await expect(card.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await card.getByRole("button", { name: "Controlla ora" }).click();
  await expect(card.getByRole("status")).toContainText(
    "Disponibile la versione 9.9.9",
  );
  await card.getByRole("button", { name: "Scarica" }).click();
  await expect(card.getByRole("status")).toContainText("è pronta");
  await expect(card).toHaveScreenshot("settings-updates.png");
});

test("restarting with a connected session asks first and says it will be closed", async ({
  page,
}) => {
  await explore(page, "available");
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await page.getByRole("option", { name: /api-01/ }).click();
  await checkFromMenu(page);
  await toasts(page).getByRole("button", { name: "Scarica" }).click();
  await toasts(page).getByRole("button", { name: "Riavvia ora" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Riavviare per aggiornare?");
  await expect(dialog).toContainText("verranno chiuse");
  expect(await relaunched(page)).toBeFalsy();
  await dialog.getByRole("button", { name: "Riavvia" }).click();
  await expect.poll(() => relaunched(page)).toBe(true);
});
