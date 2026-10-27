import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// Plain user + password typed on the host (no saved identity) must survive
// focus changes and the suggestions popup, in an empty and in a sample vault.
const open = async (page: Page, url: string) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: "Nuovo host" }).waitFor();
};

for (const [label, url] of [
  ["empty vault", "/?empty"],
  ["vault with identities", "/"],
]) {
  test(`inline credentials survive blur (${label})`, async ({ page }) => {
    await open(page, url);
    const user = page.getByRole("combobox", { name: "Utente SSH" });
    await page.getByPlaceholder("IP o nome host").fill("192.0.2.9");
    await page.getByPlaceholder("Nome dell’host").fill("inline-" + label[0]);
    await user.click();
    await user.fill("root");
    await page.getByPlaceholder("Password", { exact: true }).fill("segreto");
    await expect(user).toHaveValue("root");
    await user.click();
    // Without identities there is no popup: Escape would close the panel.
    if (url === "/") await page.keyboard.press("Escape");
    await expect(user).toHaveValue("root");
    await page.getByPlaceholder("Nome dell’host").click();
    await expect(user).toHaveValue("root");
    await user.focus();
    await page.keyboard.press("Tab");
    await expect(user).toHaveValue("root");
    await page.getByRole("heading", { name: "Nuovo host" }).click();
    await expect(user).toHaveValue("root");
    await expect(page.getByText("Identità:")).toHaveCount(0);

    await page.getByRole("button", { name: "Chiudi pannello" }).click();
    await page
      .getByRole("button", { name: "Seleziona inline-" + label[0] })
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Modifica" }).click();
    await expect(user).toHaveValue("root");
    await expect(page.getByPlaceholder("••••••••")).toHaveValue("");
  });
}

test("picking an identity and going back keeps the typed user", async ({
  page,
}) => {
  await open(page, "/");
  const user = page.getByRole("combobox", { name: "Utente SSH" });
  await user.click();
  await user.fill("root");
  await page.getByRole("option").first().click();
  await expect(page.getByText("Identità:")).toBeVisible();
  await page
    .getByRole("button", { name: "Usa credenziali proprie dell’host" })
    .click();
  await expect(page.getByText("Identità:")).toHaveCount(0);
  await expect(user).toHaveValue("root");
});
