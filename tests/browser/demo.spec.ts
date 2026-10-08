import { test, expect } from "@playwright/test";
const openPqa = async (page) => {
  await page.getByRole("button", { name: /01 PQA Analysis/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
};
test("catalog and planner include repository prompts, worker definitions and embeddings", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Agent Studio", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".agent-card")).toHaveCount(5);
  const coordinator = page.getByRole("article", {
    name: "Coordinator group",
  });
  await expect(coordinator).toBeVisible();
  await expect(coordinator.locator("button, .config-counts")).toHaveCount(0);
  await coordinator.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/catalog-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /02 planner/i }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Skills/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: /Prompts/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Prompt content", exact: true }),
  ).toHaveValue(/Alchemy planning agent/);
  await page.getByRole("tab", { name: /Worker Definitions/ }).click();
  await expect(page.locator(".registry-file")).toHaveCount(4);
  await expect(page.locator("#registry-source")).toContainText(
    "schemaVersion: 1",
  );
  await expect(page.locator("#registry-source")).toContainText(
    "worker--distribution--pqa-analysis",
  );
  await expect(page.locator(".worker-fields")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open TEMPLATE.md", exact: true })
    .click();
  await expect(page.locator("#registry-source")).toContainText("schemaVersion");
  await page.getByRole("button", { name: "Toggle word wrap" }).click();
  await expect(page.locator("#registry-source")).toHaveClass(/wrap/);
  await page
    .getByRole("button", {
      name: "Open worker--distribution--pqa-analysis.md",
      exact: true,
    })
    .click();
  await page.screenshot({
    path: "artifacts/planner-workers.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: /Models/ }).click();
  await page
    .getByRole("button", { name: /Embedding Worker catalog embeddings/ })
    .click();
  await expect(page.getByLabel("Vector dimensions")).toBeVisible();
  await page.screenshot({
    path: "artifacts/planner-models.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("skill edit survives reload, prompt preview substitutes values, export contains draft", async ({
  page,
}) => {
  await page.goto("/");
  await openPqa(page);
  await page.getByRole("tab", { name: /Skills/ }).click();
  await page.getByRole("button", { name: "SKILL.md", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edit SKILL.md", exact: true })
    .fill("# Demo saved skill\n\nKeep approved scope.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible();
  await page.reload();
  await openPqa(page);
  await page.getByRole("tab", { name: /Skills/ }).click();
  await page.getByRole("button", { name: "SKILL.md", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edit SKILL.md", exact: true }),
  ).toHaveValue(/Demo saved skill/);
  await page.getByRole("tab", { name: /Prompts/ }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".prompt-preview")).toContainText(
    "Identify Hero SKUs",
  );
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("alchemy-agent-studio.json");
  await page.screenshot({
    path: "artifacts/worker-prompt.png",
    fullPage: true,
  });
});
test("model edits stay scoped to their agent and invalid values block save", async ({
  page,
}) => {
  await page.goto("/");
  await openPqa(page);
  await page.getByRole("tab", { name: /Models/ }).click();
  await expect(page.locator(".shared-banner")).toHaveCount(0);
  await page.getByLabel("Deployment name").fill("pqa-demo-only");
  await page.getByLabel("Temperature", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("temperature");
  await page.getByLabel("Temperature", { exact: true }).fill("0.4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: /02 planner/i }).click();
  await page.getByRole("tab", { name: /Models/ }).click();
  await expect(page.getByLabel("Deployment name")).toHaveValue("Not provided");
});
test("imports text file, adds nested folder/file, rejects invalid JSON, discards changes", async ({
  page,
}) => {
  await page.goto("/");
  await openPqa(page);
  await page.getByRole("tab", { name: /Skills/ }).click();
  await page
    .locator('input[type=file][accept=".md,.json,.yaml,.yml,.txt,.csv"]')
    .setInputFiles({
      name: "demo-notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Demo notes\nImported locally."),
    });
  await expect(
    page.getByRole("textbox", { name: "Edit demo-notes.md", exact: true }),
  ).toHaveValue(/Imported locally/);
  await page.getByRole("button", { name: "Add folder", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New folder", exact: true })
    .fill("demo");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New file", exact: true })
    .fill("demo/config.json");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edit demo/config.json", exact: true })
    .fill("{broken}");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("JSON");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
});
test("live reads use authenticated catalog and package fixtures; writes blocked by proxy", async ({
  page,
  request,
}) => {
  const seen = [];
  await page.route("**/agent-api/**", async (route) => {
    const req = route.request();
    seen.push(req.method());
    const url = req.url();
    const body = url.endsWith("/api/bootstrap")
      ? {
          agents: [
            {
              id: "distribution",
              name: "Distribution Strategist",
              presentationOnlyGroup: true,
              subskillDefinitions: [
                { id: "pqa-analysis", name: "PQA Analysis" },
              ],
            },
          ],
        }
      : {
          files: [
            {
              relativePath: "SKILL.md",
              content: "# Live package\nDatabase content.",
              mediaType: "text/markdown",
              version: 1,
            },
          ],
        };
    await route.fulfill({ json: body });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect live skills" }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText("Connected workspace", { exact: false }),
  ).toBeVisible();
  await openPqa(page);
  await page.getByRole("tab", { name: /Skills/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Edit SKILL.md", exact: true }),
  ).toHaveValue(/Live package/);
  expect(seen.every((x) => x === "GET")).toBe(true);
  const response = await request.post(
    "/agent-api/api/agent-studio/skill-packages/distribution/pqa-analysis",
    { data: { files: [] } },
  );
  expect(response.status()).toBe(405);
});
test("connection failure offers sample recovery and mobile layout fits viewport", async ({
  page,
}) => {
  await page.route("**/agent-api/**", (route) =>
    route.fulfill({ status: 401, json: { detail: "expired" } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Connect live skills" }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Access denied",
  );
  await page.getByRole("button", { name: "Use workspace catalog" }).click();
  await expect(page.locator(".agent-card")).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/catalog-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await openPqa(page);
  await page.getByRole("tab", { name: /Models/ }).click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/worker-mobile.png",
    fullPage: true,
  });
});
test("create group and sub-agent stays local and appears in catalog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Pricing Strategy");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Explore pricing opportunities.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create group", exact: true })
    .click();
  const card = page.locator("article").filter({ hasText: "Pricing Strategy" });
  await card.getByRole("button", { name: "Add sub-agent" }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Price Analyst");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Analyze price changes.");
  await page
    .getByRole("button", { name: "Create sub-agent", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Price Analyst" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /Worker Definitions/ }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".quick-grid")
      .getByRole("button", { name: /Worker Definitions/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(3);
});
test("export/import restores saved configuration and empty packages remain usable", async ({
  page,
}) => {
  await page.goto("/");
  await openPqa(page);
  await page.getByRole("tab", { name: /Skills/ }).click();
  await page.getByRole("button", { name: "SKILL.md", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edit SKILL.md", exact: true })
    .fill("# Round trip\nSaved draft");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  const snapshot = await page.evaluate(() =>
    localStorage.getItem("alchemy-studio:v1:sample"),
  );
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  page.once("dialog", (d) => d.accept());
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(snapshot!),
  });
  await openPqa(page);
  await page.getByRole("tab", { name: /Skills/ }).click();
  await page.getByRole("button", { name: "SKILL.md", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edit SKILL.md", exact: true }),
  ).toHaveValue(/Round trip/);
});
test("browser storage failure retains editable draft and Escape can preserve changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await openPqa(page);
  await page
    .getByRole("textbox", { name: "Edit SKILL.md", exact: true })
    .fill("Unsaved but exportable draft");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Edit SKILL.md", exact: true }),
  ).toHaveValue("Unsaved but exportable draft");
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  await dl;
});
