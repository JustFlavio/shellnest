import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// The connection timeline in the pane. The browser preview replays the stages of a connection:
// addresses ending in .slow.test stay in authentication, .fail.test fail there.
test.beforeEach(async ({ page }) => {
  await page.goto("/?empty");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const addHost = async (page: Page, name: string, address: string) => {
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: "Nuovo host" }).waitFor();
  await page.getByPlaceholder("IP o nome host").fill(address);
  await page.getByPlaceholder("Nome dell’host").fill(name);
  await page.getByRole("combobox", { name: "Utente SSH" }).fill("root");
  await page.getByPlaceholder("Password", { exact: true }).fill("segreto");
  await page.getByRole("button", { name: "Chiudi pannello" }).click();
  await expect(
    page.getByRole("button", { name: "Seleziona " + name }),
  ).toBeVisible();
};

const open = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
};

const steps = (page: Page) =>
  page
    .getByRole("list", { name: "Avanzamento della connessione" })
    .getByRole("listitem");

test("new host: fingerprint card inside the pane, no dialog", async ({
  page,
}) => {
  await addHost(page, "nuovo", "nuovo.slow.test");
  await open(page, "nuovo");
  const approve = page.getByRole("button", {
    name: "Impronta verificata, connetti",
  });
  await expect(approve).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("SHA256:impronta-dimostrativa")).toBeVisible();
  await expect(steps(page)).toHaveText([
    /Connessione a nuovo\.slow\.test(?!:)/,
    /Verifica impronta/,
    /Autenticazione/,
    /Sessione aperta/,
  ]);
  await expect(steps(page).nth(1)).toHaveAttribute("aria-current", "step");

  await approve.click();
  await expect(steps(page).nth(2)).toHaveAttribute("aria-current", "step");
  await expect(steps(page).nth(1)).toContainText("completato");
  await expect(page.getByRole("button", { name: "Annulla" })).toHaveCount(0);
});

test("Esc on the fingerprint card cancels and closes the tab", async ({
  page,
}) => {
  await addHost(page, "nuovo", "nuovo.slow.test");
  await open(page, "nuovo");
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .waitFor();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("list", { name: "Avanzamento della connessione" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chiudi nuovo" })).toHaveCount(
    0,
  );
});

test("closing the pane while it waits drops the pending verification", async ({
  page,
}) => {
  await addHost(page, "nuovo", "nuovo.slow.test");
  await open(page, "nuovo");
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .waitFor();
  await page.getByRole("button", { name: "Chiudi nuovo" }).click();
  await expect(
    page.getByRole("button", { name: "Impronta verificata, connetti" }),
  ).toHaveCount(0);
  // shortcuts and the launcher are usable again
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await expect(page.getByRole("option", { name: /nuovo/ })).toBeVisible();
});

test("failure turns the step red with Ricomincia, Modifica host and Chiudi", async ({
  page,
}) => {
  await addHost(page, "guasto", "guasto.fail.test");
  await open(page, "guasto");
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .click();
  await expect(steps(page).nth(2).getByRole("alert")).toHaveText(
    "Autenticazione fallita",
  );
  await expect(steps(page).nth(2)).toContainText("non riuscito");
  await expect(steps(page).nth(1)).toContainText("completato");
  await expect(page.getByRole("button", { name: "Ricomincia" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Chiudi", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Modifica host" }).click();
  await expect(
    page.getByRole("heading", { name: "Modifica host" }),
  ).toBeVisible();
});

test("verified host connects without the fingerprint step", async ({
  page,
}) => {
  await addHost(page, "noto", "noto.slow.test");
  await open(page, "noto");
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .click();
  await page.getByRole("button", { name: "Chiudi noto" }).click();
  await open(page, "noto");
  await expect(steps(page)).toHaveText([
    /Connessione a/,
    /Autenticazione/,
    /Sessione aperta/,
  ]);
});

test("the timeline hands over to the terminal", async ({ page }) => {
  await addHost(page, "ok", "ok.test");
  await open(page, "ok");
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .click();
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Avanzamento della connessione" }),
  ).toHaveCount(0);
});

test("fingerprint card snapshot (reduced motion)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await addHost(page, "nuovo", "nuovo.slow.test");
  await open(page, "nuovo");
  await expect(
    page.getByRole("button", { name: "Impronta verificata, connetti" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("connection-fingerprint.png");
});

test("inline password: refused once, accepted on retry, secret not kept", async ({
  page,
}) => {
  await addHost(page, "chiave", "chiave.password.test");
  await open(page, "chiave");
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .click();
  const field = page.getByLabel("Password", { exact: true });
  await expect(field).toBeFocused();
  await expect(steps(page).nth(3)).toHaveAttribute("aria-current", "step");
  await expect(steps(page).nth(2)).toContainText("completato");

  await field.fill("sbagliata");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Password non accettata. Riprova."),
  ).toBeVisible();
  const retry = page.getByLabel("Password", { exact: true });
  await expect(retry).toHaveValue("");
  await expect(page.getByRole("button", { name: "Riprova" })).toBeDisabled();

  await retry.fill("password-giusta");
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.stringify(
      [localStorage, sessionStorage].map((s) => Object.entries(s)),
    ),
  );
  expect(stored).not.toContain("giusta");
  expect(stored).not.toContain("sbagliata");
});

test("Esc on the inline password cancels and closes the tab", async ({
  page,
}) => {
  await addHost(page, "chiave", "chiave.password.test");
  await open(page, "chiave");
  await page
    .getByRole("button", { name: "Impronta verificata, connetti" })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chiudi chiave" })).toHaveCount(
    0,
  );
});
