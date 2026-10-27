import { test, expect } from "@playwright/test";

const toasts = (page) => page.locator("[data-sonner-toast]");
const explore = async (page, query = "") => {
  await page.goto(`/${query}`);
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
};
// The app's own notify module, loaded through the dev server so it shares the page's toaster.
const notify = (page, title, detail) =>
  page.evaluate(
    async ([t, d]) => (await import("/src/lib/notify.ts")).notifyError(t, d),
    [title, detail],
  );
const lock = async (page) => {
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: "Blocca vault" }).click();
};

test("a failed action shows a toast with title and detail, and the close button dismisses it", async ({
  page,
}) => {
  await explore(page, "?fail=lock");
  await lock(page);
  const toast = toasts(page);
  await expect(toast).toHaveCount(1);
  await expect(toast).toContainText("Blocco del vault non riuscito");
  await expect(toast).toContainText("Errore simulato in lock");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await toast.hover();
  await toast.getByRole("button", { name: "Close toast" }).click();
  await expect(toasts(page)).toHaveCount(0);
});

test("identical errors do not stack, different ones do", async ({ page }) => {
  await explore(page, "?fail=lock");
  await lock(page);
  await expect(toasts(page)).toHaveCount(1);
  await lock(page);
  await lock(page);
  await expect(toasts(page)).toHaveCount(1);
  await notify(page, "Altro errore", "altro dettaglio");
  await expect(toasts(page)).toHaveCount(2);
});

test("toasts are announced through a polite live region", async ({ page }) => {
  await explore(page);
  const region = page.getByRole("region", { name: /Notifiche/ });
  await expect(region).toHaveAttribute("aria-live", "polite");
  await notify(page, "Titolo", "dettaglio");
  await expect(region).toContainText("Titolo");
});

test("Esc dismisses a toast once focus is inside the stack", async ({
  page,
}) => {
  await explore(page);
  await notify(page, "Titolo", "dettaglio");
  await expect(toasts(page)).toHaveCount(1);
  await page.keyboard.press("Alt+KeyT");
  await page.keyboard.press("Escape");
  await expect(toasts(page)).toHaveCount(0);
});

test("a failure inside an editor stays inline, not a toast", async ({
  page,
}) => {
  await explore(page, "?fail=save_group");
  await page.keyboard.press("Meta+Shift+n");
  await page.getByRole("textbox", { name: /Nome/ }).fill("Produzione");
  await page.getByRole("button", { name: "Salva gruppo" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Errore simulato in save_group",
  );
  await expect(toasts(page)).toHaveCount(0);
});

test("a toast does not take focus from the terminal", async ({ page }) => {
  await explore(page);
  await page.keyboard.press("Meta+t");
  await page.getByRole("option", { name: /api-01/ }).click();
  await page.locator(".xterm").first().click();
  const input = page.locator(".xterm-helper-textarea").first();
  await expect(input).toBeFocused();
  await notify(page, "Titolo", "dettaglio");
  await expect(toasts(page)).toHaveCount(1);
  await expect(input).toBeFocused();
});

test("toasts stay clear of the open editor sheet", async ({ page }) => {
  await explore(page);
  await page.keyboard.press("Meta+n");
  const sheet = page.locator(".side-sheet");
  await expect(sheet).toBeVisible();
  await notify(page, "Titolo", "dettaglio");
  await expect(toasts(page)).toHaveCount(1);
  const toastBox = await toasts(page).boundingBox();
  const sheetBox = await sheet.boundingBox();
  expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(sheetBox.x);
});
