import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
test.beforeEach(async ({ context }) => {
  if (process.env.STUDIO_STATIC_TEST !== "1") return;
  const root = path.resolve("dist");
  await context.route("https://studio.test/**", async (route) => {
    const pathname = decodeURIComponent(
      new URL(route.request().url()).pathname,
    ).replace(/^\/agent-studio-prototype\//, "/");
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + path.sep)) {
      await route.abort();
      return;
    }
    try {
      await route.fulfill({
        body: await readFile(file),
        contentType: file.endsWith(".js")
          ? "application/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
      });
    } catch {
      await route.fulfill({ status: 404, body: "Not found" });
    }
  });
});

const openPlanner = async (page) => {
  await page.locator(".system-card").filter({ hasText: "Planner" }).click();
};
const editor = (page) => page.locator(".skills-text-input");
const switchTo = async (page, id) => {
  await page.getByText("Try the multi-user workflow", { exact: true }).click();
  await page.getByLabel("View as user").selectOption(id);
};
test("studio lock keeps saved edits private across users and exposes them only on exit", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create group", exact: true }),
  ).toBeDisabled();
  await openPlanner(page);
  await expect(editor(page)).toHaveAttribute("readonly", "");
  await expect(
    page.getByRole("button", { name: "Add file", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Download folder as ZIP" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Edit mode", exact: true })
    .last()
    .click();
  await expect(editor(page)).not.toHaveAttribute("readonly", "");
  const initial = await editor(page).inputValue();
  const observer = await context.newPage();
  await observer.goto("/");
  await switchTo(observer, "user-b");
  await expect(
    observer.getByText("Agent Studio locked by Prakhar", { exact: true }),
  ).toBeVisible();
  await openPlanner(observer);
  await expect(editor(observer)).toHaveValue(initial);
  await editor(page).fill(initial + "\nPrivate change");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Saved privately until you exit edit mode", { exact: true }),
  ).toBeVisible();
  await expect(editor(observer)).toHaveValue(initial);
  await observer.getByRole("tab", { name: /Prompts/ }).click();
  await expect(
    observer.getByRole("button", { name: "Add prompt" }),
  ).toBeDisabled();
  await observer.getByRole("tab", { name: /Skills/ }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await openPlanner(page);
  await expect(editor(page)).toHaveValue(initial + "\nPrivate change");
  await page
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .last()
    .click();
  await expect(editor(observer)).toHaveValue(initial + "\nPrivate change");
  await expect(editor(page)).toHaveAttribute("readonly", "");
  await observer
    .getByRole("button", { name: "Edit mode", exact: true })
    .last()
    .click();
  await expect(
    observer
      .getByRole("dialog")
      .getByText("Agent Studio locked by User B (you)", { exact: true }),
  ).toBeVisible();
});
test("unsaved exit can be cancelled; confirmed exit keeps only saved data", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit mode", exact: true })
    .last()
    .click();
  await openPlanner(page);
  const initial = await editor(page).inputValue();
  await editor(page).fill(initial + "\nUnsaved");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .last()
    .click();
  await expect(editor(page)).toHaveValue(initial + "\nUnsaved");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .last()
    .click();
  await expect(editor(page)).toHaveValue(initial);
});
test("failed save retains the lock and edits for retry", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit mode", exact: true })
    .last()
    .click();
  await openPlanner(page);
  const initial = await editor(page).inputValue();
  await editor(page).fill(initial + "\nRetry me");
  await page.evaluate(() => {
    window.__originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.includes("exclusive-edit")) throw Error("Storage full");
      return window.__originalSet.call(this, k, v);
    };
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("dialog [role=alert]").first()).toHaveText(
    "Storage full",
  );
  await expect(editor(page)).toHaveValue(initial + "\nRetry me");
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__originalSet;
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Saved privately until you exit edit mode", { exact: true }),
  ).toBeVisible();
});

test("simultaneous users cannot both acquire the studio lock", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await switchTo(other, "user-b");
  await Promise.all(
    [page, other].map((p) =>
      p
        .locator(".studio-edit-status button")
        .evaluate((button: HTMLButtonElement) => button.click()),
    ),
  );
  await expect
    .poll(async () => {
      const owners = await Promise.all(
        [page, other].map((p) =>
          p
            .getByRole("button", { name: "Exit edit mode", exact: true })
            .count(),
        ),
      );
      return owners.reduce((a, b) => a + b, 0);
    })
    .toBe(1);
  const owner = (await page
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .count())
    ? page
    : other;
  const viewer = owner === page ? other : page;
  await expect(
    viewer.getByRole("button", { name: "Editing locked", exact: true }),
  ).toBeDisabled();
  await owner
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .click();
  await expect(
    viewer.getByRole("button", { name: "Edit mode", exact: true }),
  ).toBeEnabled();
});

test("sub-agent editing uses the same lock and retains file controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Open Distribution Strategist/ })
    .click();
  await page.locator(".subagent-card").first().click();
  await expect(editor(page)).toHaveAttribute("readonly", "");
  await expect(
    page.getByRole("tab", { name: /Worker Definitions/ }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Edit mode", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Import folder", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Add file", exact: true }).click();
  await page.getByLabel("New file", { exact: true }).fill("notes.md");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await editor(page).fill("# New sub-agent instructions");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Saved privately until you exit edit mode", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add file", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".file-tree button")
    .filter({ hasText: "notes.md" })
    .click();
  await expect(editor(page)).toHaveValue("# New sub-agent instructions");
});

test("models are admin-only and example selections remain temporary", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit mode", exact: true }).click();
  await openPlanner(page);
  await page.getByRole("tab", { name: "Models", exact: true }).click();
  await page.getByLabel("Model", { exact: true }).selectOption("example-b");
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: /Skills/ }).click();
  await page.getByRole("tab", { name: "Models", exact: true }).click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
    "example-b",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await openPlanner(page);
  await page.getByRole("tab", { name: "Models", exact: true }).click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await switchTo(page, "user-b");
  await openPlanner(page);
  await expect(
    page.getByRole("tab", { name: "Models", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".studio-model-picker")).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: /Open Distribution Strategist/ })
    .click();
  await page.locator(".subagent-card").first().click();
  await expect(
    page.getByRole("tab", { name: "Models", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("View as user").selectOption("user-c");
  await page.locator(".subagent-card").first().click();
  await page.getByRole("tab", { name: "Models", exact: true }).click();
  await expect(page.getByLabel("Model", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Model", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Back to groups", exact: true })
    .click();
  await openPlanner(page);
  await expect(
    page.getByRole("tab", { name: "Models", exact: true }),
  ).toBeVisible();
});

test("page import validates keys and packages, activates privately, and prevents duplicates", async ({
  page,
  context,
}) => {
  const apiRequests: string[] = [];
  context.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Edit mode", exact: true }).click();
  await page
    .getByRole("button", { name: /Open Distribution Strategist/ })
    .click();
  await page
    .getByRole("button", { name: "Add sub-agent", exact: true })
    .click();
  await page.getByLabel("pageKey", { exact: true }).fill("unknown_page");
  await page
    .getByRole("button", { name: "Generate from page", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Page not found");
  await page.getByRole("button", { name: /p_brand_growth/ }).click();
  await page
    .getByRole("button", { name: "Generate from page", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Brand Growth Analysis", exact: true }),
  ).toBeVisible();
  await editor(page).fill("");
  await page.getByRole("button", { name: "Save file(s)", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("SKILL.md");
  await expect(
    page.getByRole("button", {
      name: "Next: Planner package",
      exact: true,
    }),
  ).toBeDisabled();
  await editor(page).fill("# Customized brand growth");
  await page.getByRole("button", { name: "Save file(s)", exact: true }).click();
  await page
    .getByRole("button", { name: "Next: Planner package", exact: true })
    .click();
  await expect(editor(page)).toHaveValue(/# Planner selection:/);
  await editor(page).fill("# Plan approved brand growth requests");
  await page.getByRole("button", { name: "Save file(s)", exact: true }).click();
  await page
    .getByRole("button", { name: "Activate sub-agent", exact: true })
    .click();
  await expect(
    page.getByText("Sub-agent activated in your edit session", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".subagent-card")).toHaveCount(2);
  const observer = await context.newPage();
  await observer.goto("/");
  await switchTo(observer, "user-b");
  await observer
    .getByRole("button", { name: /Open Distribution Strategist/ })
    .click();
  await expect(observer.locator(".subagent-card")).toHaveCount(1);
  await page
    .locator(".subagent-card")
    .filter({ hasText: "Brand Growth Analysis" })
    .click();
  await expect(editor(page)).toHaveValue("# Customized brand growth");
  await expect(
    page.getByRole("tab", { name: /Worker Definitions/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Add sub-agent", exact: true })
    .click();
  await page.getByLabel("pageKey", { exact: true }).fill("p_brand_growth");
  await page
    .getByRole("button", { name: "Generate from page", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("already bound");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Exit edit mode", exact: true })
    .click();
  await expect(observer.locator(".subagent-card")).toHaveCount(2);
  await page.reload();
  await page
    .getByRole("button", { name: /Open Distribution Strategist/ })
    .click();
  await expect(page.locator(".subagent-card")).toHaveCount(2);
  expect(apiRequests).toEqual([]);
});

test("canceling a generated import does not create a card", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit mode", exact: true }).click();
  await page
    .getByRole("button", { name: /Open Distribution Strategist/ })
    .click();
  await page
    .getByRole("button", { name: "Add sub-agent", exact: true })
    .click();
  await page.getByLabel("pageKey", { exact: true }).fill("p_market_segments");
  await page
    .getByRole("button", { name: "Generate from page", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Next: Planner package",
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  await expect(page.locator(".subagent-card")).toHaveCount(1);
});
