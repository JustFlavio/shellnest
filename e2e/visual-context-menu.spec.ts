import { test, expect } from "@playwright/test";

test("native context menus are blocked and session menus still open", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).waitFor();
  const nativeMenuBlocked = () =>
    page.evaluate(
      () =>
        !document.body.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
        ),
    );
  expect(await nativeMenuBlocked()).toBe(true);

  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  expect(await nativeMenuBlocked()).toBe(true);
  // Text fields keep the native menu for cut, copy and paste.
  expect(
    await page
      .getByRole("searchbox")
      .or(page.getByRole("textbox"))
      .first()
      .evaluate(
        (field) =>
          !field.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
          ),
      ),
  ).toBe(false);

  await page
    .getByRole("button", { name: "Seleziona api-07", exact: true })
    .dblclick();
  const nav = page.getByRole("navigation", { name: "Sessioni e connessioni" });
  await nav.locator("[draggable=true]").first().click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Rinomina", exact: true }),
  ).toBeVisible();
});
