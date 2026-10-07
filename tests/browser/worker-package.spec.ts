import { test, expect } from "./static-fixture";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("worker registry supports authoring, imports, discard and persistence separately from Skills", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /02 planner/i }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.getByRole("tab", { name: /Worker Definitions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Worker definitions package" }),
  ).toBeVisible();
  for (const name of [
    "Add file",
    "Add folder",
    "Import files",
    "Import folder",
  ]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Add folder", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New folder", exact: true })
    .fill("custom");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "New file", exact: true }),
  ).toHaveValue("custom/definition.md");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edit custom/definition.md", exact: true })
    .fill("# Custom worker\nValidate scope.");
  await page
    .getByRole("button", { name: "Import files", exact: true })
    .click({ trial: true });
  await page
    .locator('input[type=file][accept=".md,.json,.yaml,.yml,.txt,.csv"]')
    .setInputFiles({
      name: "worker--new.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Imported worker\nCheck evidence."),
    });
  const directory = await mkdtemp(path.join(tmpdir(), "worker-package-"));
  await mkdir(path.join(directory, "reference"));
  await writeFile(
    path.join(directory, "reference", "guide.md"),
    "# Reference guide",
  );
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import folder", exact: true })
    .click();
  await (await chooser).setFiles(directory);
  await expect(
    page.getByRole("textbox", { name: /Edit .*guide.md/ }),
  ).toHaveValue("# Reference guide");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /02 planner/i }).click();
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(
    page.locator('.file-tree button[title="custom/definition.md"]'),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /Worker Definitions/ }).click();
  await page.locator('.file-tree button[title="custom/definition.md"]').click();
  await expect(
    page.getByRole("textbox", {
      name: "Edit custom/definition.md",
      exact: true,
    }),
  ).toHaveValue("# Custom worker\nValidate scope.");
  await expect(
    page.locator('.file-tree button[title="worker--new.md"]'),
  ).toBeVisible();
  await expect(
    page.locator('.file-tree button[title$="reference/guide.md"]'),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await expect(
    page.locator('.file-tree button[title="worker--new.md"]'),
  ).toHaveCount(0);
});
