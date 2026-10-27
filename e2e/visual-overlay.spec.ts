import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// WebKit (the engine of the macOS app) does not re-evaluate `body:has(...)` rules
// once a portalled dialog is removed, so a backdrop restyled that way stayed dark.
// Runs in the `webkit` project too: `npx playwright install webkit`.
test.beforeEach(async ({ page }) => {
  await page.goto("/?empty");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByPlaceholder("Nome dell’host").fill("uno");
});

const backdropAlpha = (page: Page) =>
  page.evaluate(() => {
    const colors = [
      ...document.querySelectorAll("[data-slot=dialog-overlay]"),
    ].map((el) => getComputedStyle(el).backgroundColor);
    // One layer only: stacked layers would compound into a darker screen.
    return colors.length === 1
      ? Number(colors[0].match(/[\d.]+/g)?.[3] ?? 1)
      : -1;
  });

test("discard dialog dims the page once and releases it when dismissed", async ({
  page,
}) => {
  await expect.poll(() => backdropAlpha(page)).toBe(0);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Chiudi pannello" }).first().click();
    await page
      .getByRole("heading", { name: "Scartare le modifiche?" })
      .waitFor();
    await expect.poll(() => backdropAlpha(page)).toBe(0.8);
    await page.getByRole("button", { name: "Chiudi pannello" }).last().click();
    await expect(
      page.getByRole("heading", { name: "Scartare le modifiche?" }),
    ).toHaveCount(0);
    await expect.poll(() => backdropAlpha(page)).toBe(0);
  }
});
