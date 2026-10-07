import { test, expect } from "./static-fixture";
const names = [
  "PQA Analysis",
  "Ad-hoc Dataset Analysis",
  "Category: Market Segments",
];
const key = (id: string) =>
  `alchemy-studio:agent-workflow:v2:alchemy-studio%3Av1%3Asample:${id}`;
const open = async (page: any, name: string) =>
  page.locator(".subagent").filter({ hasText: name }).click();
const review = async (page: any) => {
  await page.getByRole("button", { name: /Review changes/ }).click();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
};
const publish = async (page: any) => {
  await review(page);
  await page
    .getByRole("button", { name: "Publish changes", exact: true })
    .click();
  await page.getByLabel("Change summary").fill("Updated agent package");
  await page
    .getByRole("button", { name: "Confirm publication", exact: true })
    .click();
};
for (const name of names) {
  test(`${name}: complete draft workflow and correct capabilities`, async ({
    page,
  }) => {
    await page.goto("/");
    await open(page, name);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Worker Definitions/ }),
    ).toHaveCount(0);
    const editor = page.locator(".skills-text-input");
    const original = await editor.inputValue();
    await expect(editor).toHaveAttribute("readonly", "");
    await page
      .getByRole("button", { name: "Create draft", exact: true })
      .click();
    for (const button of [
      "Add file",
      "Add folder",
      "Import files",
      "Import folder",
      "Download folder as ZIP",
    ])
      await expect(
        page.getByRole("button", { name: button, exact: true }),
      ).toBeEnabled();
    await editor.fill(original + "\n\nAgent-specific addition");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.reload();
    await open(page, name);
    await expect(editor).toHaveValue(original);
    await page
      .getByRole("button", { name: "Resume draft", exact: true })
      .click();
    await expect(editor).toHaveValue(/Agent-specific addition/);
    await page.getByRole("tab", { name: /Skills/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Prompts/ })).toBeFocused();
    const prompt = page.getByLabel("Prompt content");
    await prompt.fill((await prompt.inputValue()) + "\nDraft prompt addition");
    await page.getByRole("tab", { name: /Models/ }).click();
    await page
      .getByLabel("Model version", { exact: true })
      .fill("prototype-v2");
    await publish(page);
    await expect(
      page.getByText("Active in development", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Active development", exact: true })
      .click();
    await page.getByRole("tab", { name: /Skills/ }).click();
    await expect(editor).toHaveValue(/Agent-specific addition/);
    await expect(page.getByText("Development v2 is active")).toBeVisible();
    await page
      .getByRole("button", { name: "Create draft", exact: true })
      .click();
    await editor.fill("# Discard me");
    await page
      .getByRole("button", { name: "Discard draft", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete draft", exact: true })
      .click();
    await expect(editor).toHaveValue(/Agent-specific addition/);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await open(
      page,
      names.find((n) => n !== name)!,
    );
    await expect(page.getByText("Development v1 is active")).toBeVisible();
    await expect(editor).not.toHaveValue(/Agent-specific addition/);
    await page.getByRole("tab", { name: /Models/ }).click();
    await expect(
      page.getByLabel("Model version", { exact: true }),
    ).not.toHaveValue("prototype-v2");
  });
}
test("newly created sub-agent automatically inherits workflow and a reversible tour", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".group-card")
    .first()
    .getByRole("button", { name: "Add sub-agent", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Future Analysis");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Analyze future opportunities.");
  await page
    .getByRole("button", { name: "Create sub-agent", exact: true })
    .click();
  await expect(page.getByText("Development v1 is active")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /Worker Definitions/ }),
  ).toHaveCount(0);
  const before = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(
        ([k]) =>
          k.startsWith("alchemy-studio:agent-workflow:v2:") &&
          !k.includes(":tour:"),
      ),
    ),
  );
  await page.getByRole("button", { name: "Take a tour", exact: true }).click();
  const tour = page.locator(".planner-tour");
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await tour
    .getByRole("button", { name: "Create draft & continue", exact: true })
    .click();
  await expect(tour).not.toContainText("worker definitions");
  for (let i = 0; i < 5; i++)
    await tour.getByRole("button", { name: "Next", exact: true }).click();
  await tour.getByRole("button", { name: "Finish", exact: true }).click();
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(
          ([k]) =>
            k.startsWith("alchemy-studio:agent-workflow:v2:") &&
            !k.includes(":tour:"),
        ),
      ),
    ),
  ).toEqual(before);
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page
    .locator(".skills-text-input")
    .fill("# Future analysis\nNew guidance");
  await publish(page);
  await expect(
    page.getByText("Active in development", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/shared-agent-mobile.png" });
});
test("sub-agent stale draft resolves against latest; another user remains isolated", async ({
  page,
}) => {
  await page.goto("/");
  await open(page, names[0]);
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.locator(".skills-text-input").fill("# My work");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.locator(".planner-scenarios summary").click();
  await page.getByLabel("Act as").selectOption({ label: "Maya" });
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page.locator(".skills-text-input")).not.toHaveValue("# My work");
  await page.getByLabel("Act as").selectOption({ label: "Prakhar" });
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate development update", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Advance development", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish changes", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Update against latest", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: /Resolution for/ })
    .selectOption("mine");
  await page
    .getByRole("button", { name: "Save updated draft", exact: true })
    .click();
  await publish(page);
  await page.getByLabel("Act as").selectOption({ label: "Maya" });
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(page.getByText("Development has advanced to v3")).toBeVisible();
  await expect(page.locator(".skills-text-input")).not.toHaveValue("# My work");
});
