import { test, expect } from "@playwright/test";

// Partial terminal rows must use the theme too, including after a resize.
test("terminal viewport fills partial rows with its theme", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page
    .getByRole("button", { name: /Connessione rapida|Nuova connessione/ })
    .click();
  await page.getByRole("option", { name: /api-01/ }).dblclick();
  const viewport = page.locator(".xterm-viewport").first();
  await expect(viewport).toBeVisible();
  for (const height of [801, 847, 900]) {
    await page.setViewportSize({ width: 1280, height });
    await expect(viewport).toHaveCSS("background-color", "rgb(23, 20, 15)");
  }
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page.getByRole("tab", { name: "Terminale", exact: true }).click();
  await page.getByRole("radio", { name: "Nord" }).click();
  await expect(viewport).toHaveCSS("background-color", "rgb(46, 52, 64)");
});
