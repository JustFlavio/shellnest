import { test, expect } from "@playwright/test";

// First run: `?empty` starts the browser preview with no hosts, identities,
// keys or folders, which the sample data of the other specs never exercise.
test.beforeEach(async ({ page }) => {
  await page.goto("/?empty");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const newHost = async (page) => {
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: "Nuovo host" }).waitFor();
};

// Hosts need credentials to be saved, so each one gets its own user and password.
const addHost = async (page, name, address) => {
  await newHost(page);
  await page.getByPlaceholder("IP o nome host").fill(address);
  await page.getByPlaceholder("Nome dell’host").fill(name);
  await page.getByRole("combobox", { name: "Utente SSH" }).fill("root");
  await page.getByPlaceholder("Password", { exact: true }).fill("segreto");
  await page.getByRole("button", { name: "Chiudi pannello" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo host" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Seleziona " + name })).toBeVisible();
};

test("empty vault has no sample data", async ({ page }) => {
  await expect(page.getByRole("button", { name: /^Seleziona / })).toHaveCount(0);
});

test("selection bar needs two or more hosts", async ({ page }) => {
  await addHost(page, "uno", "192.0.2.1");
  await addHost(page, "due", "192.0.2.2");
  const bar = page.getByRole("toolbar", { name: "Azioni host selezionati" });
  await page.getByRole("button", { name: "Seleziona uno" }).click();
  await expect(bar).toHaveCount(0);
  await page.getByRole("button", { name: "Seleziona due" }).click({ modifiers: ["ControlOrMeta"] });
  await expect(bar).toBeVisible();
  await expect(bar.getByText("2 selezionati")).toBeVisible();
  await page.getByRole("button", { name: "Seleziona due" }).click({ modifiers: ["ControlOrMeta"] });
  await expect(bar).toHaveCount(0);
});

