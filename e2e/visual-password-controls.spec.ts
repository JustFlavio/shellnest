import { test, expect } from "@playwright/test";

test("the app password toggle still reveals and masks typed passwords", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Blocca vault/ }).click();
  const password = page.locator('input[autocomplete="current-password"]');
  await password.pressSequentially("synthetic-password");
  await expect(
    page.getByRole("button", { name: "Mostra password", exact: true }),
  ).toHaveCount(1);
  await page.screenshot({
    path: "artifacts/password-controls/single-eye.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Mostra password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("synthetic-password");
  await page
    .getByRole("button", { name: "Nascondi password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
});
