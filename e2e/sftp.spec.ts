import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function openFiles(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the interface" }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page
    .getByRole("button", { name: "Actions for api-07", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Open files (SFTP)", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "This computer", exact: true })
      .getByRole("button", { name: "notes.txt", exact: true }),
  ).toBeVisible();
}

test("Files opens without a shell; transfers and the terminal survive view switches", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFiles(page);
  await expect(page.locator(".xterm")).toHaveCount(0);
  const local = page.getByRole("region", {
    name: "This computer",
    exact: true,
  });
  const remote = page.getByRole("region", { name: "api-07", exact: true });
  const splitter = page.getByRole("separator", {
    name: "Resize local and remote panes",
  });
  await splitter.focus();
  await page.keyboard.press("ArrowRight");
  await expect(splitter).toHaveAttribute("aria-valuenow", "52");
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(page.locator(".xterm-helper-textarea")).toBeVisible();
  await page.evaluate(() =>
    [...window.__terminals.values()][0].write("SFTP_SWITCH_SENTINEL"),
  );
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await local
    .getByRole("checkbox", { name: "Select notes.txt", exact: true })
    .check();
  await local.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(
    page.getByText("Needs a decision", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep both", exact: true }).click();
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(page.locator(".xterm")).toHaveCount(1);
  expect(
    await page.evaluate(() => {
      const buffer = [...window.__terminals.values()][0].buffer.active;
      return Array.from({ length: buffer.length }, (_, n) =>
        buffer.getLine(n)?.translateToString(),
      ).join("\n");
    }),
  ).toContain("SFTP_SWITCH_SENTINEL");
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await expect(
    remote.getByRole("button", { name: "notes (1).txt", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Completed/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("files.png") });
  expect(errors).toEqual([]);
});

test("file actions, navigation and folder drag use the same browser and queue", async ({
  page,
}, testInfo) => {
  await openFiles(page);
  const local = page.getByRole("region", {
    name: "This computer",
    exact: true,
  });
  const remote = page.getByRole("region", { name: "api-07", exact: true });
  await local.getByRole("button", { name: "New folder", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New folder", exact: true });
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("transfer-test");
  await dialog.getByRole("button", { name: "New folder", exact: true }).click();
  await expect(
    local.getByRole("button", { name: "transfer-test", exact: true }),
  ).toBeVisible();
  await local
    .getByRole("checkbox", { name: "Select transfer-test", exact: true })
    .check();
  await local.getByRole("button", { name: "Rename", exact: true }).click();
  const rename = page.getByRole("dialog", { name: "Rename", exact: true });
  await rename
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("renamed");
  await rename.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(
    local.getByRole("button", { name: "renamed", exact: true }),
  ).toBeVisible();
  await local
    .getByRole("checkbox", { name: "Select notes.txt", exact: true })
    .check();
  await local
    .getByRole("searchbox", { name: "Filter this folder", exact: true })
    .fill("renamed");
  await local
    .getByRole("checkbox", { name: "Select renamed", exact: true })
    .check();
  await local.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "Delete", exact: true })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    local.getByRole("button", { name: "renamed", exact: true }),
  ).toHaveCount(0);
  await local
    .getByRole("searchbox", { name: "Filter this folder", exact: true })
    .fill("");
  await expect(
    local.getByRole("button", { name: "notes.txt", exact: true }),
  ).toBeVisible();
  await local
    .getByRole("button", { name: "projects", exact: true })
    .dragTo(remote);
  await page.getByRole("button", { name: "Keep both", exact: true }).click();
  await remote
    .getByRole("button", { name: "projects (1)", exact: true })
    .dblclick();
  await expect(
    remote.getByRole("button", { name: "readme.md", exact: true }),
  ).toBeVisible();
  await remote.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    remote.getByRole("button", { name: "projects (1)", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 760, height: 700 });
  await page.screenshot({ path: testInfo.outputPath("files-narrow.png") });
});
