import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const search = (page: Page) =>
  page.getByRole("combobox", { name: "Cerca host o schede" });
// Typing opens the search menu under the input; the page list below keeps the history.
const menu = (page: Page) =>
  page.getByRole("listbox", { name: "Risultati ricerca" });
const pageList = (page: Page) =>
  page.getByRole("listbox", { name: "Connessioni disponibili" });
const group = (page: Page, heading: string) =>
  menu(page).getByRole("group", { name: heading, exact: true });
const targetRow = (page: Page) =>
  group(page, "Connessione rapida").getByRole("option", {
    name: /^root@|:\d+/,
  });

async function openLauncher(page: Page) {
  await page.keyboard.press("Meta+t");
  await search(page).waitFor();
}

async function openApi01(page: Page) {
  await openLauncher(page);
  await pageList(page)
    .getByRole("option", { name: /api-01/ })
    .dblclick();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
}

test("an open host is listed under Host and its tab under Schede; the tab row switches to it", async ({
  page,
}) => {
  await openApi01(page);
  await search(page).fill("api-01");
  await expect(group(page, "Host").getByRole("option")).toHaveCount(1);
  const tabs = group(page, "Schede").getByRole("option");
  await expect(tabs).toHaveCount(1);
  await tabs.click();
  await expect(search(page)).toHaveCount(0);
  await expect(page.locator(".xterm")).toHaveCount(1);
});

test("the Host row of an open host opens a second session", async ({
  page,
}) => {
  await openApi01(page);
  await search(page).fill("api-01");
  await group(page, "Host").getByRole("option").click();
  await expect(page.locator(".xterm")).toHaveCount(2);
});

test("a bare word never offers a quick connection", async ({ page }) => {
  await openLauncher(page);
  await search(page).fill("rc");
  await expect(targetRow(page)).toHaveCount(0);
});

test("targets offer a quick connection row", async ({ page }) => {
  await openLauncher(page);
  await search(page).fill("root@1.2.3.4");
  const quick = group(page, "Connessione rapida");
  // the default port is left out
  await expect(quick.getByRole("option").first()).toContainText("root@1.2.3.4");
  await expect(quick.getByRole("option").first()).not.toContainText(":22");
  await search(page).fill("10.0.0.5:2222");
  await expect(quick.getByRole("option").first()).toContainText(
    "10.0.0.5:2222",
  );
  await expect(quick.getByRole("option")).toHaveCount(2);
});

test("Cmd+Enter starts the connection timeline with the target", async ({
  page,
}) => {
  await openLauncher(page);
  await search(page).fill("rc");
  await search(page).press("Meta+Enter");
  await expect(search(page)).toHaveCount(0);
  await expect(page.getByLabel("Utente", { exact: true })).toBeFocused();
  await expect(
    page.getByRole("list", { name: "Avanzamento della connessione" }),
  ).toContainText(/Connessione a rc(?!:)/);
});

test("an empty vault says nothing is saved", async ({ page }) => {
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page
    .getByRole("navigation", { name: "Sezioni delle impostazioni" })
    .getByRole("button", { name: "Vault" })
    .click();
  await page.getByRole("button", { name: "Nuovo vault" }).click();
  await page.getByPlaceholder(/Personale, Lavoro/).fill("Vuoto");
  await page.getByRole("button", { name: /^Crea/ }).click();
  await page.getByLabel("Password principale").fill("password-di-prova-123");
  await page.getByLabel("Conferma password").fill("password-di-prova-123");
  await page.getByRole("button", { name: "Crea vault", exact: true }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await openLauncher(page);
  await search(page).fill("rc");
  await expect(page.getByText("Nessun host salvato.")).toBeVisible();
  await expect(targetRow(page)).toHaveCount(0);
});

test("a saved host without a tab is listed under Host only", async ({
  page,
}) => {
  await openLauncher(page);
  await search(page).fill("api-01");
  await expect(group(page, "Schede")).toHaveCount(0);
  await expect(
    group(page, "Host").getByRole("option", { name: /api-01/ }),
  ).toHaveCount(1);
});

test("the local terminal is always listed under Connessione rapida", async ({
  page,
}) => {
  await openLauncher(page);
  await search(page).click();
  const local = group(page, "Connessione rapida").getByRole("option", {
    name: /Terminale/,
  });
  await expect(local).toBeVisible();
  await search(page).fill("api-01");
  await expect(local).toBeVisible();
  await search(page).fill("zzzz");
  await expect(local).toBeVisible();
});

test("groups come in order and arrow keys cross them", async ({ page }) => {
  await openApi01(page);
  await search(page).fill("api");
  const headings = menu(page).locator("[cmdk-group-heading]");
  await expect(headings).toHaveText(["Host", "Schede", "Connessione rapida"]);
  const selected = menu(page).locator("[data-launch-selected]");
  const hosts = group(page, "Host").getByRole("option");
  await expect(selected).toContainText("api-01");
  await search(page).press("ArrowDown");
  await expect(selected).toContainText("api-02");
  const hostRows = await hosts.count();
  for (let i = 1; i < hostRows; i++) await search(page).press("ArrowDown");
  await expect(selected).toContainText("deploy@192.0.2.10");
  await search(page).press("ArrowDown");
  await expect(selected).toContainText("Terminale");
  await search(page).press("ArrowUp");
  await search(page).press("ArrowUp");
  await expect(hosts.last()).toHaveAttribute("data-launch-selected", "");
});

test("Cmd+J lists only the open tabs, newest first", async ({ page }) => {
  await openLauncher(page);
  await page.getByRole("option", { name: /api-01/ }).dblclick();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
  await page.getByRole("option", { name: /database-01/ }).dblclick();
  await page.waitForTimeout(700);
  await page.keyboard.press("Meta+j");
  const jump = page.getByRole("combobox", { name: "Cerca host o schede" });
  await expect(jump).toHaveAttribute("placeholder", "Vai alla scheda");
  await expect(menu(page).locator("[cmdk-group-heading]")).toHaveText([
    "Schede",
    "Connessione rapida",
  ]);
  const rows = group(page, "Schede").getByRole("option");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("database-01");
  await expect(rows.last()).toContainText("api-01");
  await jump.fill("api");
  await expect(rows).toHaveCount(1);
  await jump.press("Enter");
  await expect(jump).toHaveCount(0);
  await expect(page.locator(".xterm")).toHaveCount(2);
});

test("the launcher explains no keyboard commands", async ({ page }) => {
  await openLauncher(page);
  await expect(page.getByText(/Maiusc\+Invio|Invio apre/)).toHaveCount(0);
  await page.keyboard.press("Meta+j");
  await expect(page.getByText("Invio passa alla scheda")).toHaveCount(0);
});

const selectedRows = (page: Page) =>
  page.locator("[cmdk-item][aria-selected=true]");
const row = (page: Page, name: RegExp) => page.getByRole("option", { name });
const pageRow = (page: Page, name: RegExp) =>
  pageList(page).getByRole("option", { name });
const createButton = (page: Page) =>
  page.getByRole("button", { name: "Crea workspace" });

test("a single click selects a row without opening it", async ({ page }) => {
  await openLauncher(page);
  await row(page, /api-02/).click();
  await expect(selectedRows(page)).toHaveCount(1);
  await expect(selectedRows(page)).toContainText("api-02");
  await expect(search(page)).toBeFocused();
  await expect(page.locator(".xterm")).toHaveCount(0);
  await row(page, /api-01/).click();
  await expect(selectedRows(page)).toContainText("api-01");
  await expect(search(page)).toBeVisible();
  await search(page).press("Enter");
  await page.locator(".xterm").first().waitFor();
});

test("a double click opens the row, like Enter", async ({ page }) => {
  await openLauncher(page);
  await row(page, /database-01/).dblclick();
  await expect(search(page)).toHaveCount(0);
  await expect(page.locator(".xterm")).toHaveCount(1);
});

test("Cmd+click multi-selects hosts and unlocks Crea workspace", async ({
  page,
}) => {
  await openLauncher(page);
  const listbox = page.getByRole("listbox");
  await expect(listbox).toHaveAttribute("aria-multiselectable", "true");
  await expect(createButton(page)).toBeDisabled();
  await row(page, /api-01/).click();
  await expect(createButton(page)).toBeDisabled();
  await row(page, /api-02/).click({ modifiers: ["Meta"] });
  await expect(selectedRows(page)).toHaveCount(2);
  await expect(createButton(page)).toBeEnabled();
  await row(page, /api-02/).click({ modifiers: ["Meta"] });
  await expect(selectedRows(page)).toHaveCount(1);
  await expect(createButton(page)).toBeDisabled();
  await row(page, /api-02/).click({ modifiers: ["Meta"] });
  await row(page, /database-01/).click({ modifiers: ["Meta"] });
  await createButton(page).click();
  const dialog = page.getByRole("dialog", { name: "Crea workspace" });
  await dialog.getByRole("textbox").fill("Selezione");
  await dialog.getByRole("button", { name: /^(Crea|Salva)/ }).click();
  await page.locator(".xterm").first().waitFor();
  await expect(page.locator(".xterm")).toHaveCount(3);
});

test("Shift+click selects the range between two hosts", async ({ page }) => {
  await openLauncher(page);
  const hosts = pageList(page)
    .getByRole("group", { name: "Connessioni recenti", exact: true })
    .getByRole("option");
  const count = await hosts.count();
  expect(count).toBeGreaterThan(3);
  await hosts.nth(1).click();
  await hosts.nth(3).click({ modifiers: ["Shift"] });
  await expect(selectedRows(page)).toHaveCount(3);
  await expect(hosts.nth(0)).toHaveAttribute("aria-selected", "false");
  await expect(hosts.nth(2)).toHaveAttribute("aria-selected", "true");
  await hosts.nth(0).click({ modifiers: ["Shift"] });
  await expect(selectedRows(page)).toHaveCount(2);
  await expect(createButton(page)).toBeEnabled();
});

test("Esc closes the menu, then clears a multi-selection, then the search", async ({
  page,
}) => {
  await openLauncher(page);
  await search(page).fill("api");
  // the first Esc closes the search menu and keeps the text
  await search(page).press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(search(page)).toHaveValue("api");
  await pageRow(page, /api-01/).click();
  await pageRow(page, /api-02/).click({ modifiers: ["Meta"] });
  await expect(selectedRows(page)).toHaveCount(2);
  await search(page).press("Escape");
  await expect(selectedRows(page)).toHaveCount(1);
  await expect(search(page)).toHaveValue("api");
  await search(page).press("Escape");
  await expect(search(page)).toHaveValue("");
});

test("only host rows join a multi-selection", async ({ page }) => {
  await openLauncher(page);
  await row(page, /api-01/).click();
  await row(page, /Produzione.*connessioni/).click({ modifiers: ["Meta"] });
  await expect(selectedRows(page)).toHaveCount(1);
  await expect(selectedRows(page)).toContainText("connessioni");
  await expect(createButton(page)).toBeDisabled();
});

test("arrow keys and clicks share one selection", async ({ page }) => {
  await openLauncher(page);
  await row(page, /api-02/).click();
  await search(page).press("ArrowDown");
  await expect(selectedRows(page)).toHaveCount(1);
  await expect(selectedRows(page)).not.toContainText("api-02");
  await row(page, /api-01/).click();
  await row(page, /api-02/).click({ modifiers: ["Meta"] });
  await search(page).press("ArrowDown");
  await expect(selectedRows(page)).toHaveCount(1);
});

test("Ripristina opens the selected hosts", async ({ page }) => {
  await openLauncher(page);
  const restore = page.getByRole("button", { name: /Ripristina/ });
  await expect(restore).toBeDisabled();
  await pageRow(page, /api-01/).click();
  await expect(restore).toBeEnabled();
  await pageRow(page, /api-02/).click({ modifiers: ["Meta"] });
  await expect(restore).toHaveText(/Ripristina \(2\)/);
  await restore.click();
  await expect(page.locator(".xterm")).toHaveCount(2);
});
