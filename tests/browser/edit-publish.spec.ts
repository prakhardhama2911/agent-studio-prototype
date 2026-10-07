import { test, expect } from "./static-fixture";
// Agent publishing is covered by agent-workflow.spec.ts; group metadata stays independent.
test("group editing and publishing", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Manage group", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await page.getByRole("button", { name: "Edit mode", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Updated group");
  await page
    .getByRole("button", { name: "Publish changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish changes", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("heading", { name: "Updated group" }),
  ).toBeVisible();
});
