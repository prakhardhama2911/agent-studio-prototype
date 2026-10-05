import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedRead,
  validatePath,
  validateFile,
  exportDocument,
  parseDocument,
  saveDraft,
  loadDraft,
  identityScope,
} from "../src/lib/core.mjs";
const data = { agents: [], groups: [], workers: [], models: [] };
test("export round-trips configuration and excludes connection state", () => {
  const exported = exportDocument(data);
  assert.deepEqual(parseDocument(exported), data);
  assert.equal(JSON.parse(exported).version, 1);
  assert.equal("token" in JSON.parse(exported), false);
});
test("reject malformed exports and unsupported versions", () => {
  for (const value of [
    "{}",
    "null",
    '{"format":"alchemy-studio-prototype","version":2}',
    exportDocument({ ...data, agents: [{ id: "bad" }] }),
  ])
    assert.throws(() => parseDocument(value));
});
test("drafts persist by connection identity and storage failures propagate", () => {
  const map = new Map();
  const storage = {
    setItem: (k, v) => map.set(k, v),
    getItem: (k) => map.get(k) || null,
  };
  saveDraft(storage, "sample", data);
  assert.deepEqual(loadDraft(storage, "sample"), data);
  assert.equal(loadDraft(storage, "another-tenant"), null);
  assert.throws(
    () =>
      saveDraft(
        {
          setItem() {
            throw Error("quota");
          },
        },
        "sample",
        data,
      ),
    /quota/,
  );
});
test("backend allowlist accepts package reads and blocks all writes", () => {
  for (const path of [
    "/api/bootstrap",
    "/api/agents/coordinator",
    "/api/agent-studio/skill-packages/distribution/pqa-analysis",
  ]) {
    assert.equal(allowedRead("GET", path), true);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"])
      assert.equal(allowedRead(method, path), false);
  }
  for (const path of [
    "/api/agent-studio/drafts",
    "/api/agents/coordinator?secret=1",
    "/api/bootstrap/extra",
  ])
    assert.equal(allowedRead("GET", path), false);
});
test("file validation rejects unsafe paths and invalid JSON", () => {
  for (const path of [
    "../SKILL.md",
    "/SKILL.md",
    "a/../b.md",
    "a\\b.md",
    "a//b.md",
    "photo.png",
  ])
    assert.equal(validatePath(path), false);
  assert.equal(validateFile("references/a.json", '{"ok":true}'), "");
  assert.match(validateFile("references/a.json", "{oops}"), /JSON/);
  assert.match(validateFile("SKILL.md", " "), /empty/);
});
test("identity scope isolates tenants without storing the bearer token", () => {
  const token = (payload) =>
    "header." +
    Buffer.from(JSON.stringify(payload)).toString("base64url") +
    ".signature";
  assert.notEqual(
    identityScope(token({ sub: "person", tenant_id: "a" })),
    identityScope(token({ sub: "person", tenant_id: "b" })),
  );
  assert.equal(identityScope(""), "anonymous");
  assert.throws(() => identityScope("invalid"));
});

test("model edits copy reused settings without changing another agent", async () => {
  const { editAssignedModel } = await import("../src/lib/core.mjs");
  const catalog = {
    agents: [
      { id: "planner", modelIds: ["base"] },
      { id: "worker", modelIds: ["base"] },
    ],
    models: [{ id: "base", deployment: "original" }],
  };
  const edited = editAssignedModel(
    catalog,
    "worker",
    "base",
    { deployment: "worker-deployment" },
    "worker-model",
  );
  assert.deepEqual(edited.modelIds, ["worker-model"]);
  assert.equal(
    edited.models.find((m) => m.id === "base").deployment,
    "original",
  );
  assert.equal(
    edited.models.find((m) => m.id === "worker-model").deployment,
    "worker-deployment",
  );
  assert.deepEqual(catalog.agents[0].modelIds, ["base"]);
  const subsequent = editAssignedModel(
    {
      models: edited.models,
      agents: [catalog.agents[0], { id: "worker", modelIds: edited.modelIds }],
    },
    "worker",
    "worker-model",
    { deployment: "updated" },
    "unused",
  );
  assert.equal(subsequent.models.length, 2);
  assert.equal(subsequent.selectedId, "worker-model");
  assert.equal(
    subsequent.models.find((m) => m.id === "worker-model").deployment,
    "updated",
  );
});
