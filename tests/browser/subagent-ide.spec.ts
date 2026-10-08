import { test, expect } from "@playwright/test";
for (const name of ["PQA Analysis", "Ad-hoc Dataset Analysis", "Category: Market Segments"]) {
  test(name + " uses the shared Skills IDE", async ({ page }) => {
    await page.goto("/");
    await page.locator("button.subagent").filter({ hasText: name }).click();
    await expect(page.getByRole("tab", { name: /Skills/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".registry-ide.skills-ide")).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Open skill files" })).toBeVisible();
    await expect(page.locator(".skills-text-input")).toBeVisible();
    await expect(page.locator(".skills-highlight .registry-line-number").first()).toBeVisible();
    for (const label of ["Add file", "Add folder", "Import files", "Import folder", "Toggle word wrap", "Copy file contents"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await page.screenshot({ path: "artifacts/subagent-ide-" + name.replace(/[^a-z0-9]/gi, "-") + ".png" });
  });
}
