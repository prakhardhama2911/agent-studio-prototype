import { test, expect } from "@playwright/test";
const openPlanner = async (page: any) => {
  await page.goto("/");
  await page.getByRole("button", { name: /02 planner/i }).click();
};
const create = async (page: any) => {
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
};
const publish = async (page: any) => {
  await page
    .getByRole("button", { name: "Publish changes", exact: true })
    .click();
  await page
    .getByLabel("Change summary")
    .fill("Reviewed planning instructions");
  await page
    .getByRole("button", { name: "Confirm publication", exact: true })
    .click();
};
const advance = async (page: any) => {
  await page.locator(".planner-scenarios summary").click();
  await page
    .getByRole("button", { name: "Simulate development update", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Advance development", exact: true })
    .click();
};

test("draft autosaves, resumes, reviews and publishes directly to development", async ({
  page,
}) => {
  await openPlanner(page);
  const source = page.locator(".skills-text-input");
  const original = await source.inputValue();
  await expect(source).toHaveAttribute("readonly", "");
  await create(page);
  await source.fill(
    original + "\n\n# Added guidance\nConfirm reporting period.",
  );
  await expect(page.getByRole("status")).toHaveText("Draft saved");
  await page.reload();
  await page.getByRole("button", { name: /02 planner/i }).click();
  await expect(source).toHaveValue(original);
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(source).toHaveValue(/Added guidance/);
  await page.getByRole("button", { name: /Review changes \(1\)/ }).click();
  await expect(page.locator(".planner-diff-source .added")).toContainText([
    "# Added guidance",
  ]);
  await page.getByRole("button", { name: "Close review" }).click();
  await page.screenshot({ path: "artifacts/planner-persistent-draft.png" });
  await publish(page);
  await expect(
    page.getByText("Active in development", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Simulate Git/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Active development", exact: true })
    .click();
  await expect(source).toHaveValue(/Added guidance/);
  await expect(page.getByText("Development v13 is active")).toBeVisible();
});

test("stale drafts are blocked until updated, then publication activates", async ({
  page,
}) => {
  await openPlanner(page);
  await create(page);
  const source = page.locator(".skills-text-input");
  await source.fill((await source.inputValue()) + "\nMy planning addition.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await advance(page);
  await expect(page.getByText("Development has advanced to v13")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish changes", exact: true }),
  ).toBeDisabled();
  await expect(source).toHaveValue(/My planning addition/);
  await page
    .getByRole("button", { name: "Update against latest", exact: true })
    .click();
  await expect(page.locator(".planner-conflict")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: /Resolution for/ })
    .selectOption("manual");
  await page
    .getByRole("textbox", { name: /Merged content for/ })
    .fill(
      "# Combined instructions\nConfirm reporting period.\nMy planning addition.",
    );
  await page.screenshot({ path: "artifacts/planner-resolve-baseline.png" });
  await page
    .getByRole("button", { name: "Save updated draft", exact: true })
    .click();
  await publish(page);
  await expect(
    page.getByText("Active in development", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Active development", exact: true })
    .click();
  await expect(source).toHaveValue(/Combined instructions/);
  await expect(page.getByText("Development v14 is active")).toBeVisible();
  await page.screenshot({ path: "artifacts/planner-publications.png" });
});

test("parallel user drafts are isolated and discarding one preserves the other", async ({
  page,
}) => {
  await openPlanner(page);
  await create(page);
  const source = page.locator(".skills-text-input");
  const original = await source.inputValue();
  await source.fill(original + "\nPrakhar edit");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.locator(".planner-scenarios summary").click();
  await page.getByLabel("Act as").selectOption("Maya");
  await create(page);
  await expect(source).toHaveValue(original);
  await source.fill(original + "\nMaya edit");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await page.getByLabel("Act as").selectOption("Prakhar");
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(source).toHaveValue(/Prakhar edit/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/planner-draft-mobile.png" });
});

test("invalid publication retains draft and storage failures do not claim success", async ({
  page,
}) => {
  await openPlanner(page);
  await create(page);
  await page.getByRole("tab", { name: /Worker Definitions/ }).click();
  await page.locator(".skills-text-input").fill("");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await publish(page);
  await expect(
    page.getByRole("dialog").last().getByRole("alert"),
  ).toContainText("File content cannot be empty");
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.locator(".skills-text-input").fill("# Repaired definition");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage is full");
    };
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Storage is full");
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
});
