import { test, expect } from "@playwright/test";
for (const agent of [/01 PQA Analysis/]) {
  test("edit and publish " + agent, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: agent }).click();
    const editor = page.locator(".skills-text-input");
    await expect(editor).toHaveAttribute("readonly", "");
    await expect(
      page.getByRole("button", { name: "Add file", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Export", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Download folder as ZIP" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Edit mode", exact: true }).click();
    const content = await editor.inputValue();
    await editor.fill(content + "\nPublished instruction.");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Publish changes", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Publish changes", exact: true })
      .click();
    await expect(editor).toHaveAttribute("readonly", "");
    await expect(
      page.getByRole("button", { name: "Publish changes", exact: true }),
    ).toBeDisabled();
    await page.reload();
    await page.getByRole("button", { name: agent }).click();
    await expect(editor).toHaveValue(/Published instruction/);
    await expect(
      page.getByRole("button", { name: "Publish changes", exact: true }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: /Prompts/ }).click();
    await expect(page.getByLabel("Prompt content")).toHaveAttribute(
      "readonly",
      "",
    );
    await page.getByRole("tab", { name: /Models/ }).click();
    await expect(page.getByLabel("Profile name")).toBeDisabled();
  });
}
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
