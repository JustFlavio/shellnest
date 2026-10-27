import { test, expect } from "@playwright/test";

// Behaviour of the shortcut editor in the browser preview (forced to macOS bindings).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { value: "MacIntel" });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page.getByRole("button", { name: "Scorciatoie" }).click();
});

const row = (page, label) =>
  page
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) });
const edit = (page, label) =>
  page.getByRole("button", { name: `Modifica “${label}”` }).click();

test("rebind, persist and reset one shortcut", async ({ page }) => {
  await edit(page, "Chiudi pane o scheda");
  await page.keyboard.press("Meta+y");
  await expect(row(page, "Chiudi pane o scheda")).toContainText("⌘Y");
  expect(
    await page.evaluate(() => localStorage.getItem("shellnest.shortcuts")),
  ).toContain('"y"');
  await page
    .getByRole("button", { name: "Ripristina “Chiudi pane o scheda”" })
    .click();
  await expect(row(page, "Chiudi pane o scheda")).toContainText("⌘W");
  expect(
    await page.evaluate(() => localStorage.getItem("shellnest.shortcuts")),
  ).toBe("{}");
});

test("reserved combos are refused, Escape cancels, Backspace unbinds", async ({
  page,
}) => {
  await edit(page, "Pulisci terminale");
  await page.keyboard.press("Meta+q");
  await expect(page.getByRole("alert")).toContainText("riservata");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Impostazioni" }),
  ).toBeVisible();
  await expect(row(page, "Pulisci terminale")).toContainText("⌘K");
  await edit(page, "Pulisci terminale");
  await page.keyboard.press("Backspace");
  await expect(row(page, "Pulisci terminale")).toContainText("Nessuna");
});

test("a taken combo asks before moving it", async ({ page }) => {
  await edit(page, "Pulisci terminale");
  await page.keyboard.press("Meta+t");
  await expect(page.getByRole("alert")).toContainText("Connessione rapida");
  await page.getByRole("button", { name: "Riassegna" }).click();
  await expect(row(page, "Pulisci terminale")).toContainText("⌘T");
  await expect(row(page, "Connessione rapida")).toContainText("Nessuna");
  await page.getByRole("button", { name: "Ripristina tutte" }).click();
  await expect(row(page, "Connessione rapida")).toContainText("⌘T");
  await expect(row(page, "Pulisci terminale")).toContainText("⌘K");
});

test("a rebound shortcut drives the app, the old one stops", async ({
  page,
}) => {
  await edit(page, "Connessione rapida");
  await page.keyboard.press("Meta+y");
  await page.keyboard.press("Escape");
  const launcher = page.getByPlaceholder(/Cerca host o schede/);
  await page.keyboard.press("Meta+t");
  await expect(launcher).toHaveCount(0);
  await page.keyboard.press("Meta+y");
  await expect(launcher).toBeVisible();
});
