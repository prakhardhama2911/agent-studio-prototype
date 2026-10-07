import test from "node:test";
import assert from "node:assert/strict";
import {
  initialWorkflow,
  createDraft,
  saveDraft,
  publishDraft,
  simulateAdvance,
  mergePlan,
  packageFromArtefacts,
  changes,
} from "../src/plannerWorkflow.ts";
const pkg = () => ({
  files: {
    "core/SKILL.md": "# Core\nOriginal",
    "routing/SKILL.md": "# Routing",
  },
  workerFiles: { "worker--pqa.md": "# PQA\nDefinition" },
  prompts: [
    { id: "system", name: "System", purpose: "Plan", content: "Make a plan" },
  ],
  models: [],
  modelIds: [],
});

test("draft owners are isolated, persisted, and revision checked", () => {
  let s = createDraft(createDraft(initialWorkflow(pkg()), "Prakhar"), "Maya");
  const d = s.drafts.Prakhar,
    content = structuredClone(d.content);
  content.files["core/SKILL.md"] = "# Changed";
  s = saveDraft(s, "Prakhar", d.id, d.revision, content);
  assert.equal(
    s.development.content.files["core/SKILL.md"],
    "# Core\nOriginal",
  );
  assert.equal(
    s.drafts.Maya.content.files["core/SKILL.md"],
    "# Core\nOriginal",
  );
  assert.equal(
    JSON.parse(JSON.stringify(s)).drafts.Prakhar.content.files["core/SKILL.md"],
    "# Changed",
  );
  assert.throws(
    () => saveDraft(s, "Prakhar", d.id, d.revision, content),
    /another session/,
  );
});
test("publishing activates atomically and closes only the owning draft", () => {
  let s = createDraft(createDraft(initialWorkflow(pkg()), "Prakhar"), "Maya");
  s.drafts.Prakhar.content.workerFiles["worker--pqa.md"] =
    "# New worker definition";
  const before = structuredClone(s.development);
  s = publishDraft(s, "Prakhar", "Registry update");
  const publication = structuredClone(s.publications.at(-1));
  assert.equal(s.development.version, before.version + 1);
  assert.equal(s.development.publicationId, publication.id);
  assert.ok(s.drafts.Maya);
  assert.equal(s.drafts.Prakhar, undefined);
  assert.equal(publication.baselineId, before.publicationId);
  const immutable = structuredClone(s.publications);
  s = simulateAdvance(s);
  assert.deepEqual(s.publications.slice(0, immutable.length), immutable);
  assert.equal(
    s.development.content.workerFiles["worker--pqa.md"],
    "# New worker definition",
  );
  assert.deepEqual(
    s.publications.find((p) => p.id === publication.id),
    publication,
  );
});
test("stale draft publication is rejected without changing state", () => {
  let s = createDraft(initialWorkflow(pkg()), "Prakhar");
  s.drafts.Prakhar.content.files["core/SKILL.md"] = "# My change";
  s = simulateAdvance(s);
  const before = structuredClone(s);
  assert.throws(
    () => publishDraft(s, "Prakhar", "Stale change"),
    /newer version is available/,
  );
  assert.deepEqual(s, before);
  assert.ok(s.drafts.Prakhar);
});

test("three-way update merges unrelated files and detects modify/delete conflicts", () => {
  const base = pkg(),
    mine = pkg(),
    latest = pkg();
  mine.files["routing/SKILL.md"] = "# My routing";
  latest.workerFiles["worker--pqa.md"] = "# Updated registry";
  let plan = mergePlan(base, mine, latest);
  assert.equal(plan.conflicts.length, 0);
  let merged = packageFromArtefacts(plan.merged);
  assert.equal(merged.files["routing/SKILL.md"], "# My routing");
  assert.equal(merged.workerFiles["worker--pqa.md"], "# Updated registry");
  delete mine.files["core/SKILL.md"];
  latest.files["core/SKILL.md"] = "# Other update";
  plan = mergePlan(base, mine, latest);
  assert.deepEqual(plan.conflicts, ["skills/core/SKILL.md"]);
  assert.ok(changes(base, mine).some((x) => x.kind === "Deleted"));
});
