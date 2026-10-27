import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// First run: `?empty` starts the browser preview with no hosts, identities,
// keys or folders, which the sample data of the other specs never exercise.
test.beforeEach(async ({ page }) => {
  await page.goto("/?empty");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const newHost = async (page: Page) => {
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: "Nuovo host" }).waitFor();
};

// Hosts need credentials to be saved, so each one gets its own user and password.
const addHost = async (page: Page, name: string, address: string) => {
  await newHost(page);
  await page.getByPlaceholder("IP o nome host").fill(address);
  await page.getByPlaceholder("Nome dell’host").fill(name);
  await page.getByRole("combobox", { name: "Utente SSH" }).fill("root");
  await page.getByPlaceholder("Password", { exact: true }).fill("segreto");
  await page.getByRole("button", { name: "Chiudi pannello" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo host" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Seleziona " + name }),
  ).toBeVisible();
};

test("empty vault has no sample data", async ({ page }) => {
  await expect(page.getByRole("button", { name: /^Seleziona / })).toHaveCount(
    0,
  );
});

test("selection bar needs two or more hosts", async ({ page }) => {
  await addHost(page, "uno", "192.0.2.1");
  await addHost(page, "due", "192.0.2.2");
  const bar = page.getByRole("toolbar", { name: "Azioni host selezionati" });
  await page.getByRole("button", { name: "Seleziona uno" }).click();
  await expect(bar).toHaveCount(0);
  await page
    .getByRole("button", { name: "Seleziona due" })
    .click({ modifiers: ["ControlOrMeta"] });
  await expect(bar).toBeVisible();
  await expect(bar.getByText("2 selezionati")).toBeVisible();
  await page
    .getByRole("button", { name: "Seleziona due" })
    .click({ modifiers: ["ControlOrMeta"] });
  await expect(bar).toHaveCount(0);
});

test("first host: identity created inline", async ({ page }) => {
  await newHost(page);
  await page.getByRole("button", { name: "Crea identità condivisa" }).click();
  await page.getByRole("heading", { name: "Nuova identità" }).waitFor();
  await page.getByRole("textbox", { name: "Nome" }).fill("Amministrazione");
  await page.getByRole("textbox", { name: "Utente SSH" }).fill("root");
  await page
    .getByRole("combobox", { name: "Metodo di autenticazione" })
    .click();
  await page.getByRole("option", { name: "Password" }).click();
  await page.getByLabel("Password", { exact: true }).fill("segreto");
  await page.getByRole("button", { name: "Salva e torna all’host" }).click();
  await expect(page.getByText("Identità:")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Utente SSH" })).toHaveValue(
    "root",
  );
});

test("first host: folder created inline", async ({ page }) => {
  await newHost(page);
  await page.getByRole("combobox", { name: "Cartella" }).click();
  await page
    .getByRole("button", { name: "Crea cartella", exact: true })
    .click();
  await page.getByRole("heading", { name: "Nuovo gruppo" }).waitFor();
  await page.getByRole("textbox", { name: "Nome" }).fill("Produzione");
  await page.getByRole("button", { name: "Salva e torna all’host" }).click();
  await expect(page.getByRole("combobox", { name: "Cartella" })).toHaveValue(
    "Produzione",
  );
});

test("host draft survives a visit to a terminal tab", async ({ page }) => {
  await addHost(page, "uno", "192.0.2.1");
  await page.getByRole("button", { name: "Seleziona uno" }).dblclick();
  const nav = page.getByRole("navigation", { name: "Sessioni e connessioni" });
  const session = nav.locator("[draggable=true]").first();
  await session.waitFor();
  await nav.getByRole("button", { name: "Vault", exact: true }).click();
  await newHost(page);
  await page.getByPlaceholder("Nome dell’host").fill("bozza");
  // A short window makes the sheet scroll; the position must survive too.
  await page.setViewportSize({ width: 1280, height: 420 });
  const body = page.locator(".host-editor > div");
  await expect
    .poll(() => body.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeGreaterThan(120);
  await body.evaluate((el) => (el.scrollTop = 120));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(120);
  const discard = page.getByRole("heading", { name: "Scartare le modifiche?" });
  // A real click: with a modal sheet open its backdrop would intercept it.
  await session.locator("button", { hasText: "uno" }).click({ timeout: 3000 });
  await expect(
    page.getByRole("heading", { name: "Host", level: 1 }),
  ).toBeHidden();
  await expect(page.getByRole("heading", { name: "Nuovo host" })).toBeHidden();
  await expect(discard).toHaveCount(0);
  await nav.getByRole("button", { name: "Vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nuovo host" })).toBeVisible();
  await expect(page.getByPlaceholder("Nome dell’host")).toHaveValue("bozza");
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBe(120);
});

test("leaving a dirty draft from inside the vault still asks", async ({
  page,
}) => {
  await newHost(page);
  await page.getByPlaceholder("Nome dell’host").fill("bozza");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Scartare le modifiche?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Scarta modifiche" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo host" })).toHaveCount(
    0,
  );
});
