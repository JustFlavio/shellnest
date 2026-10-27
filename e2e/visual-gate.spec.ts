import { test, expect } from "@playwright/test";

test("login screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).waitFor();
  await expect(page).toHaveScreenshot("login.png");
});
