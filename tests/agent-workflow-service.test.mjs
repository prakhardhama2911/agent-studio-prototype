import test from "node:test";
import assert from "node:assert/strict";
import {
  createAgentWorkflowService,
  workflowStorageKey,
} from "../src/agentWorkflowService.ts";
import {
  initialWorkflow,
  createDraft,
  WORKFLOW_KEY,
} from "../src/agentWorkflow.ts";
const memory = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    values,
  };
};
const model = {
  id: "shared",
  name: "Reasoning",
  kind: "Language model",
  provider: "Test",
  model: "test",
  version: "1",
  deployment: "test",
  endpoint: "",
  apiVersion: "",
  client: "",
  credentialRef: "",
  timeout: 30,
  retries: 1,
  temperature: 0.2,
  topP: 1,
  maxTokens: 100,
  reasoning: "",
  dimensions: 1,
  batchSize: 1,
};
const agent = (id = "a", role = "worker") => ({
  id,
  name: id,
  role,
  description: "Description",
  scope: "",
  instructions: "",
  files: { "SKILL.md": "# Initial" },
  workerFiles: { "should-not-leak.md": "Planner only" },
  prompts: [
    { id: "system", name: "System", purpose: "", content: "Do the task" },
  ],
  modelIds: ["shared"],
  origin: "Repository example",
});
const make = (storage, a = agent(), catalogId = "sample") =>
  createAgentWorkflowService({
    storage,
    catalogId,
    agent: a,
    data: { agents: [a], models: [model], groups: [], workers: [] },
    workerFiles: { "worker.md": "# Worker" },
  });
const ref = (s, owner = "prakhar") => ({
  owner,
  id: s.drafts[owner].id,
  revision: s.drafts[owner].revision,
});

test("agent, catalog and user drafts remain isolated; review and publication are revision checked", async () => {
  const storage = memory(),
    a = make(storage),
    b = make(storage, agent("b")),
    otherCatalog = make(storage, agent(), "other");
  let s = await a.createDraft("prakhar");
  await a.createDraft("maya");
  await b.load();
  await otherCatalog.load();
  const content = structuredClone(s.drafts.prakhar.content);
  content.files["SKILL.md"] = "# Edited";
  content.models[0].temperature = 0.8;
  s = await a.saveDraft(ref(s), content);
  await assert.rejects(a.publish(ref(s), "changes"), /Review your latest/);
  s = await a.reviewDraft(ref(s), content);
  const reviewedRef = ref(s);
  s = await a.saveDraft(reviewedRef, content);
  assert.equal(s.drafts.prakhar.reviewedRevision, s.drafts.prakhar.revision);
  await assert.rejects(a.discardDraft(reviewedRef), /another session/);
  s = await a.publish(ref(s), "Ready");
  assert.equal(s.development.version, 2);
  assert.equal(s.publications[0].content.files["SKILL.md"], "# Initial");
  assert.equal(s.drafts.maya.content.files["SKILL.md"], "# Initial");
  assert.equal((await b.loadActive()).content.models[0].temperature, 0.2);
  assert.equal((await otherCatalog.loadActive()).version, 1);
  assert.equal("workerFiles" in s.development.content, false);
  assert.equal("workerFiles" in s.publications[1].baseline, false);
  s = await a.createDraft("prakhar");
  const changed = structuredClone(s.drafts.prakhar.content);
  changed.files["SKILL.md"] += " again";
  s = await a.reviewDraft(ref(s), changed);
  changed.files["SKILL.md"] += " more";
  s = await a.saveDraft(ref(s), changed);
  assert.equal(s.drafts.prakhar.reviewedRevision, undefined);
  await assert.rejects(
    a.saveDraft(ref(s), { ...changed, workerFiles: { "bad.md": "x" } }),
    /Planner only/,
  );
});

test("stale publication and outdated update targets fail without losing drafts", async () => {
  const service = make(memory());
  let s = await service.createDraft("prakhar");
  const content = structuredClone(s.drafts.prakhar.content);
  content.files["SKILL.md"] = "# Mine";
  s = await service.reviewDraft(ref(s), content);
  const oldTarget = s.development.publicationId;
  await service.simulateUpdate();
  await assert.rejects(service.publish(ref(s), "old"), /newer version/);
  await assert.rejects(
    service.updateDraft(ref(s), oldTarget, content),
    /advanced again/,
  );
  const latest = await service.load();
  s = await service.updateDraft(
    ref(latest),
    latest.development.publicationId,
    content,
  );
  assert.equal(s.drafts.prakhar.reviewedRevision, undefined);
  s = await service.reviewDraft(ref(s), content);
  s = await service.publish(ref(s), "Resolved");
  assert.equal(s.development.version, 3);
});

test("Planner migration retains history, review and legacy recovery data only in bundled catalog", async () => {
  const storage = memory();
  const pkg = {
    files: { "SKILL.md": "# Baseline" },
    workerFiles: { "w.md": "# Worker" },
    prompts: [],
    models: [],
    modelIds: [],
  };
  let old = createDraft(initialWorkflow(pkg), "Prakhar");
  old.drafts.Prakhar.content.files["SKILL.md"] = "# Saved";
  old.drafts.Prakhar.reviewedRevision = 1;
  const raw = JSON.stringify(old);
  storage.setItem(WORKFLOW_KEY, raw);
  const service = make(
    storage,
    agent("planner", "planner"),
    "alchemy-studio:v1:sample",
  );
  const migrated = await service.load();
  assert.equal(migrated.development.version, 12);
  assert.equal(migrated.drafts.prakhar.reviewedRevision, 1);
  assert.equal(migrated.publications[0].id, "planner-pub-012");
  assert.equal(storage.getItem(WORKFLOW_KEY), raw);
  const live = await make(storage, agent("planner", "planner"), "live").load();
  assert.deepEqual(live.drafts, {});
  assert.deepEqual((await service.load()).drafts, migrated.drafts);
});

test("legacy sub-agent keeps published baseline and saved unpublished edits", async () => {
  const a = agent();
  a.publishedConfiguration = JSON.stringify({
    files: { "SKILL.md": "# Published" },
    workerFiles: { "legacy.md": "x" },
    prompts: a.prompts,
    modelIds: a.modelIds,
    models: [model],
  });
  const s = await make(memory(), a).load();
  assert.equal(s.development.content.files["SKILL.md"], "# Published");
  assert.equal(s.drafts.prakhar.content.files["SKILL.md"], "# Initial");
  assert.equal("workerFiles" in s.drafts.prakhar.content, false);
  assert.equal(s.publications.length, 1);
});

test("storage failure and malformed migration preserve old data and do not report success", async () => {
  const storage = memory();
  const service = make(storage);
  let s = await service.createDraft("prakhar");
  const before = storage.getItem(workflowStorageKey("sample", "a"));
  storage.setItem = () => {
    throw Error("Storage is full");
  };
  await assert.rejects(
    service.reviewDraft(ref(s), s.drafts.prakhar.content),
    /Storage is full/,
  );
  assert.equal(storage.getItem(workflowStorageKey("sample", "a")), before);
  const broken = memory();
  broken.setItem(WORKFLOW_KEY, "{broken");
  await assert.rejects(
    make(
      broken,
      agent("planner", "planner"),
      "alchemy-studio:v1:sample",
    ).load(),
  );
  assert.equal(broken.getItem(WORKFLOW_KEY), "{broken");
  assert.equal(
    broken.getItem(workflowStorageKey("alchemy-studio:v1:sample", "planner")),
    null,
  );
});

test("duplicate save requests and review changes are guarded by saved revision", async () => {
  const service = make(memory());
  let s = await service.createDraft("prakhar");
  const r = ref(s);
  const p = structuredClone(s.drafts.prakhar.content);
  p.files["SKILL.md"] = "# Updated";
  const results = await Promise.allSettled([
    service.saveDraft(r, p),
    service.saveDraft(r, p),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  s = await service.load();
  const original = JSON.stringify(s);
  p.models[0].temperature = 10;
  s = await service.reviewDraft(ref(s), p);
  const reviewed = JSON.stringify(s);
  await assert.rejects(
    service.publish(ref(s), "Invalid"),
    /generation settings/,
  );
  assert.equal(JSON.stringify(await service.load()), reviewed);
  assert.notEqual(reviewed, original);
});
