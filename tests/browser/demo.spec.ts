import { test, expect } from "./static-fixture";
test("catalog remains display-only for Coordinator; Planner contains worker definitions and embeddings", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".agent-card")).toHaveCount(5);
  const coordinator = page.getByRole("article", { name: "Coordinator group" });
  await expect(coordinator.locator("button, .config-counts")).toHaveCount(0);
  await coordinator.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /02 planner/i }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /Worker Definitions/ }).click();
  await expect(page.locator(".skills-text-input")).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(page.locator(".file-tree")).toContainText("TEMPLATE.md");
  await page.getByRole("tab", { name: /Models/ }).click();
  await page
    .getByRole("button", { name: /Embedding Worker catalog embeddings/ })
    .click();
  await expect(page.getByLabel("Vector dimensions")).toBeDisabled();
});
test("prompt preview works inside a sub-agent draft", async ({ page }) => {
  await page.goto("/");
  await page.locator(".subagent").filter({ hasText: "PQA Analysis" }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.getByRole("tab", { name: /Prompts/ }).click();
  await page.getByLabel("Prompt content").fill("Question: {{question}}");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".prompt-preview")).toContainText(
    "Identify Hero SKUs",
  );
});
test("invalid model configuration may be saved in draft but cannot be published", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".subagent").filter({ hasText: "PQA Analysis" }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.getByRole("tab", { name: /Models/ }).click();
  await page.getByLabel("Temperature", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("button", { name: /Review changes/ }).click();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish changes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm publication", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").last().getByRole("alert"),
  ).toContainText("generation settings");
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue(
    "3",
  );
});
