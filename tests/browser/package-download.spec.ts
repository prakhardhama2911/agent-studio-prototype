import { test, expect } from "./static-fixture";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";

test("Planner downloads complete skills and registry packages", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /02 planner/i }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  for (const [tab, root] of [
    ["Skills", "skills"],
    ["Worker Definitions", "worker-registry"],
  ]) {
    await page.getByRole("tab", { name: new RegExp("^" + tab) }).click();
    const originalFiles = await page
      .locator(".file-tree button:not([aria-expanded])")
      .count();
    await page.getByRole("button", { name: "Add file", exact: true }).click();
    await page
      .getByRole("textbox", { name: "New file", exact: true })
      .fill("nested/download-check.md");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Edit nested/download-check.md" })
      .fill("# Unsaved content\nUnicode: \u2713");
    await page
      .getByRole("textbox", { name: "Filter package files" })
      .fill("download-check");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download folder as ZIP" }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("planner-" + root + ".zip");
    const entries = unzipSync(await readFile((await download.path())!));
    expect(Object.keys(entries)).toHaveLength(originalFiles + 1);
    expect(strFromU8(entries[root + "/nested/download-check.md"])).toBe(
      "# Unsaved content\nUnicode: \u2713",
    );
    expect(
      Object.keys(entries).every((name) => name.startsWith(root + "/")),
    ).toBe(true);
  }
  await page.reload();
  await page.getByRole("button", { name: /01 PQA Analysis/ }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download folder as ZIP" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("pqa-analysis-skills.zip");
  const entries = unzipSync(await readFile((await download.path())!));
  expect(strFromU8(entries["skills/SKILL.md"])).toContain("PQA Analysis");
  expect(entries["skills/references/worker-definition.md"]).toBeUndefined();
});
