import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const search = (page) =>
  page.getByRole("combobox", { name: "Cerca host o schede" });
const group = (page, heading) =>
  page.getByRole("group", { name: heading, exact: true });
const targetRow = (page) => page.getByRole("option", { name: /:\d+$/ });

async function openLauncher(page) {
  await page.keyboard.press("Meta+t");
  await search(page).waitFor();
}

test("a host with an open tab is one row that switches to it", async ({
  page,
}) => {
  await openLauncher(page);
  await page.getByRole("option", { name: /api-01/ }).click();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
  await search(page).fill("api-01");
  await expect(group(page, "Host")).toHaveCount(0);
  const rows = group(page, "Schede").getByRole("option");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("aperta");
  await expect(
    page.getByRole("button", { name: "Nuova sessione api-01" }),
  ).toBeAttached();
  await rows.click();
  await expect(search(page)).toHaveCount(0);
  await expect(page.locator(".xterm")).toHaveCount(1);
});

test("a new session of an open host opens a second tab", async ({ page }) => {
  await openLauncher(page);
  await page.getByRole("option", { name: /api-01/ }).click();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
  await search(page).fill("api-01");
  await page
    .getByRole("button", { name: "Nuova sessione api-01" })
    .click({ force: true });
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
  await expect(quick.getByRole("option").first()).toContainText(
    "root@1.2.3.4:22",
  );
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
  ).toContainText("Connessione a rc:22");
});

test("an empty vault explains how to connect", async ({ page }) => {
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: /Impostazioni/ }).click();
  await page.getByRole("button", { name: "Nuovo vault" }).click();
  await page.getByPlaceholder(/Personale, Lavoro/).fill("Vuoto");
  await page.getByRole("button", { name: /^Crea/ }).click();
  await page.getByLabel("Password principale").fill("password-di-prova-123");
  await page.getByLabel("Conferma password").fill("password-di-prova-123");
  await page.getByRole("button", { name: "Crea vault", exact: true }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await openLauncher(page);
  await search(page).fill("rc");
  await expect(
    page.getByText(/Invio per una connessione rapida/),
  ).toBeVisible();
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
  const local = group(page, "Connessione rapida").getByRole("option", {
    name: /Terminale locale/,
  });
  await expect(local).toBeVisible();
  await search(page).fill("api-01");
  await expect(local).toBeVisible();
  await search(page).fill("zzzz");
  await expect(local).toBeVisible();
});

test("groups come in order and arrow keys cross them", async ({ page }) => {
  await openLauncher(page);
  await page.getByRole("option", { name: /api-01/ }).click();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
  await search(page).fill("api");
  const headings = page.locator("[cmdk-group-heading]");
  await expect(headings).toHaveText(["Schede", "Host", "Connessione rapida"]);
  const selected = page.locator("[cmdk-item][data-selected=true]");
  await expect(selected).toContainText("api-01");
  await search(page).press("ArrowDown");
  await expect(selected).toContainText("api-02");
  await expect(group(page, "Host").getByRole("option").first()).toHaveAttribute(
    "data-selected",
    "true",
  );
  const hostRows = await group(page, "Host").getByRole("option").count();
  for (let i = 0; i < hostRows; i++) await search(page).press("ArrowDown");
  await expect(selected).toContainText("Terminale locale");
  await search(page).press("ArrowUp");
  await expect(
    group(page, "Host").getByRole("option").last(),
  ).toHaveAttribute("data-selected", "true");
});

test("Cmd+J lists only the open tabs, newest first", async ({ page }) => {
  await openLauncher(page);
  await page.getByRole("option", { name: /api-01/ }).click();
  await page.locator(".xterm").first().waitFor();
  await openLauncher(page);
  await page.getByRole("option", { name: /database-01/ }).click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Meta+j");
  const jump = page.getByRole("combobox", { name: "Cerca host o schede" });
  await expect(jump).toHaveAttribute("placeholder", "Vai alla scheda");
  await expect(page.locator("[cmdk-group-heading]")).toHaveText(["Schede"]);
  const rows = page.getByRole("option");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("database-01");
  await expect(rows.last()).toContainText("api-01");
  await jump.fill("api");
  await expect(rows).toHaveCount(1);
  await jump.press("Enter");
  await expect(jump).toHaveCount(0);
  await expect(page.locator(".xterm")).toHaveCount(2);
});
