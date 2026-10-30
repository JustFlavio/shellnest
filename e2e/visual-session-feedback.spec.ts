import { test, expect } from "@playwright/test";

test("an initial connection failure keeps retry in the timeline without reconnect controls", async ({
  page,
}) => {
  await page.goto("/?empty", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByPlaceholder("IP o nome host").fill("unreachable.fail.test");
  await page.getByPlaceholder("Nome dell’host").fill("Failed attempt");
  await page.getByRole("combobox", { name: "Utente SSH" }).fill("root");
  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("synthetic-password");
  await page.getByRole("button", { name: "Chiudi pannello" }).click();
  await page
    .getByRole("button", { name: "Seleziona Failed attempt" })
    .dblclick();
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .click();
  await expect(
    page.getByRole("button", { name: "Ricomincia", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Riconnetti", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/session-feedback/initial-failure.png",
    animations: "disabled",
  });
});

test("search results have distinct hover feedback and spacing without moving the keyboard cursor", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page
    .getByRole("button", { name: "Nuova connessione", exact: true })
    .click();
  const search = page.getByRole("combobox", {
    name: "Cerca host o schede",
    exact: true,
  });
  await search.click();
  const menu = page.locator("[data-search-menu]");
  const rows = menu
    .locator("[cmdk-group-items]")
    .first()
    .locator("[cmdk-item]");
  await expect(rows.nth(1)).toBeVisible();
  const boxes = await rows.evaluateAll((elements) =>
    elements.slice(0, 2).map((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }),
  );
  expect(boxes[1].top - boxes[0].bottom).toBeGreaterThanOrEqual(4);
  const background = await rows
    .nth(1)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const cursor = await menu
    .locator("[data-launch-selected]")
    .getAttribute("data-value");
  await rows.nth(1).hover();
  await expect
    .poll(() =>
      rows
        .nth(1)
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(background);
  await expect(menu.locator("[data-launch-selected]")).toHaveAttribute(
    "data-value",
    cursor!,
  );
  await expect(search).toBeFocused();
  await page.screenshot({
    path: "artifacts/session-feedback/search-hover.png",
    animations: "disabled",
  });
});
