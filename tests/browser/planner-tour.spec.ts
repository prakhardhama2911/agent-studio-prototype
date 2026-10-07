import { test, expect } from "./static-fixture";
const openPlanner = async (page: any) => {
  await page.goto("/");
  await page.getByRole("button", { name: /02 planner/i }).click();
};
test("guided tour restores initial view without persisting its temporary draft", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openPlanner(page);
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  const tour = page.locator(".planner-tour");
  await expect(tour).toBeVisible();
  await expect(tour.getByRole("heading")).toHaveText(
    "Start with the active version",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:planner",
      ),
    ),
  ).not.toBeNull();
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await page.screenshot({ path: "artifacts/planner-tour-create.png" });
  await tour.getByRole("button", { name: "Create draft & continue" }).click();
  await expect(tour.getByRole("heading")).toHaveText("Choose what to update");
  for (const heading of [
    "Edit your package",
    "Save now or continue later",
    "Review what changed",
    "Publish when you are ready",
    "Find your version history",
  ]) {
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    await expect(tour.getByRole("heading")).toHaveText(heading);
    const box = await tour.locator(".planner-tour-card").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(1000);
  }
  await tour.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(tour).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:planner",
      ),
    ),
  ).not.toBeNull();
  await expect(
    page.getByRole("button", { name: "Create draft", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".planner-stepper")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            "alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:planner",
          )!,
        ).drafts,
    ),
  ).toEqual({});
  await page.reload();
  await page.getByRole("button", { name: /02 planner/i }).click();
  await expect(
    page.getByRole("button", { name: "Take a tour", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Draft guide", exact: true }).click();
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    tour.getByRole("button", { name: "Create draft & continue" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("tour is dismissible and stays within a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlanner(page);
  await page.getByRole("button", { name: "Dismiss tour invitation" }).click();
  await page.getByRole("button", { name: "Draft guide", exact: true }).click();
  const tour = page.locator(".planner-tour");
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  const card = tour.locator(".planner-tour-card");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(845);
  await page.screenshot({ path: "artifacts/planner-tour-mobile.png" });
  await tour.getByRole("button", { name: "Skip tour" }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:planner",
      ),
    ),
  ).not.toBeNull();
});

for (const exit of ["skip", "close", "escape"]) {
  test(
    "tour " + exit + " restores Publications and does not create a saved draft",
    async ({ page }) => {
      await openPlanner(page);
      await page.getByRole("button", { name: /^Publications/ }).click();
      await page
        .getByRole("button", { name: "Draft guide", exact: true })
        .click();
      const tour = page.locator(".planner-tour");
      await tour.getByRole("button", { name: "Next", exact: true }).click();
      await tour
        .getByRole("button", { name: "Create draft & continue" })
        .click();
      if (exit === "escape") await page.keyboard.press("Escape");
      else
        await tour
          .getByRole("button", {
            name: exit === "skip" ? "Skip tour" : "Close draft guide",
            exact: true,
          })
          .click();
      await expect(tour).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^Publications/ }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(() =>
          localStorage.getItem(
            "alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:planner",
          ),
        ),
      ).not.toBeNull();
    },
  );
}

test("tour preserves real draft, unsaved edits, and selected tab", async ({
  page,
}) => {
  await openPlanner(page);
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  const source = page.locator(".skills-text-input");
  await source.fill("# Existing real work");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("tab", { name: /Prompts/ }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem(
      "alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:planner",
    ),
  );
  await page.getByLabel("Prompt content").fill("Unsaved prompt work");
  await page.getByRole("button", { name: "Draft guide", exact: true }).click();
  const tour = page.locator(".planner-tour");
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForTimeout(900);
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:planner",
      ),
    ),
  ).toBe(before);
  await tour.getByRole("button", { name: "Close draft guide" }).click();
  await expect(page.getByRole("tab", { name: /Prompts/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Prompt content")).toHaveValue(
    "Unsaved prompt work",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /02 planner/i }).click();
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(source).toHaveValue("# Existing real work");
});
