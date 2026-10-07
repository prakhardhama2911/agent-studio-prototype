import { test, expect } from "./static-fixture";

test("planner Skills has the registry-style IDE and retains authoring controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /02 planner/i }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page.locator(".skills-ide")).toBeVisible();
  for (const name of [
    "Add file",
    "Add folder",
    "Import files",
    "Import folder",
    "Delete selected file",
    "Toggle word wrap",
    "Copy file contents",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(
    page.locator(".skills-highlight .registry-key").first(),
  ).toBeVisible();
  const source = page.getByRole("textbox", { name: /Edit .*SKILL.md/ });
  const original = await source.inputValue();
  await source.fill(
    original + "\n\n# New section\nPreserve this edit when switching tabs.",
  );
  const routing = page.locator('.file-tree button[title="routing/SKILL.md"]');
  await routing.click();
  await expect(
    page.getByRole("tablist", { name: "Open skill files" }).getByRole("tab"),
  ).toHaveCount(2);
  await page
    .getByRole("tablist", { name: "Open skill files" })
    .getByRole("tab")
    .first()
    .click();
  await expect(
    page.getByRole("textbox", { name: /Edit .*SKILL.md/ }),
  ).toHaveValue(/Preserve this edit/);
  await page
    .getByRole("button", { name: "Toggle word wrap", exact: true })
    .click();
  await expect(page.locator(".skills-edit-surface")).toHaveClass(/wrap/);
  const size = await page
    .locator(".skills-text-input")
    .evaluate((node: HTMLTextAreaElement) => ({
      scroll: node.scrollHeight,
      client: node.clientHeight,
      width: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 4);
  expect(size.width).toBeLessThanOrEqual(size.clientWidth + 4);
  await page.screenshot({ path: "artifacts/planner-skills-ide.png" });
  expect(errors).toEqual([]);
});

test("sub-agent files remain editable across add, import, preview, save and delete", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /01 PQA Analysis/ }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.getByRole("button", { name: "Add folder", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New folder", exact: true })
    .fill("guidance");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New file", exact: true })
    .fill("guidance/notes.md");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const content =
    "# Instructions\n\n" +
    Array.from(
      { length: 120 },
      (_, i) =>
        `${i + 1}. Validate the requested scope and return supported findings.`,
    ).join("\n");
  await page
    .getByRole("textbox", { name: "Edit guidance/notes.md", exact: true })
    .fill(content);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".skills-file-panel .markdown")).toContainText(
    "Validate the requested scope",
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edit guidance/notes.md", exact: true })
    .press("Control+End");
  await page.keyboard.type("\nAdditional instruction.");
  await expect(
    page.getByRole("textbox", { name: "Edit guidance/notes.md", exact: true }),
  ).toHaveValue(/Additional instruction\.$/);
  await page
    .locator('input[type=file][accept=".md,.json,.yaml,.yml,.txt,.csv"]')
    .setInputFiles({
      name: "imported.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Imported\n\nReview evidence."),
    });
  await expect(
    page.getByRole("textbox", { name: "Edit imported.md", exact: true }),
  ).toHaveValue(/Review evidence/);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.screenshot({ path: "artifacts/subagent-skills-ide.png" });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete selected file", exact: true })
    .click();
  await expect(
    page
      .getByRole("tablist", { name: "Open skill files" })
      .getByRole("tab", { name: "imported.md", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/skills-ide-mobile.png" });
});
