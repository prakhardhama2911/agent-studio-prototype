import type { Agent, ModelProfile, Prompt, StudioData } from "./types";
import { validateFile } from "./lib/core.mjs";

export type PlannerPackage = {
  files: Record<string, string>;
  workerFiles: Record<string, string>;
  prompts: Prompt[];
  modelIds: string[];
  models: ModelProfile[];
};
export type PlannerDraft = {
  id: string;
  owner: string;
  baselineId: string;
  baselineVersion: number;
  baseline: PlannerPackage;
  content: PlannerPackage;
  revision: number;
  savedAt: string;
};
export type Publication = {
  id: string;
  baselineId: string;
  baselineVersion: number;
  baseline: PlannerPackage;
  content: PlannerPackage;
  author: string;
  summary: string;
  createdAt: string;
  sourceDraftId?: string;
};
export type WorkflowState = {
  schema: 1;
  development: {
    version: number;
    publicationId: string;
    content: PlannerPackage;
  };
  drafts: Record<string, PlannerDraft>;
  publications: Publication[];
  releases: { publicationId: string; version: number; at: string }[];
};
export const WORKFLOW_KEY = "alchemy-studio:planner-workflow:v1";
export const copy = <T>(value: T): T => structuredClone(value);
export function packageFrom(
  data: StudioData,
  agent: Agent,
  workerFiles: Record<string, string>,
): PlannerPackage {
  return copy({
    files: agent.files,
    workerFiles: agent.workerFiles ?? workerFiles,
    prompts: agent.prompts,
    modelIds: agent.modelIds,
    models: data.models.filter((m) => agent.modelIds.includes(m.id)),
  });
}
export function initialWorkflow(content: PlannerPackage): WorkflowState {
  const at = new Date().toISOString();
  return {
    schema: 1,
    development: {
      version: 12,
      publicationId: "planner-pub-012",
      content: copy(content),
    },
    drafts: {},
    publications: [
      {
        id: "planner-pub-012",
        baselineId: "planner-pub-011",
        baselineVersion: 11,
        baseline: copy(content),
        content: copy(content),
        author: "Release team",
        summary: "Current development configuration",
        createdAt: at,
      },
    ],
    releases: [{ publicationId: "planner-pub-012", version: 12, at }],
  };
}
export function createDraft(
  state: WorkflowState,
  owner: string,
  publication?: Publication,
): WorkflowState {
  if (state.drafts[owner])
    throw Error("Resume or discard your existing draft first.");
  const next = copy(state),
    d = state.development;
  next.drafts[owner] = {
    id: crypto.randomUUID(),
    owner,
    baselineId: publication?.baselineId ?? d.publicationId,
    baselineVersion: publication?.baselineVersion ?? d.version,
    baseline: copy(publication?.baseline ?? d.content),
    content: copy(publication?.content ?? d.content),
    revision: 1,
    savedAt: new Date().toISOString(),
  };
  return next;
}
export function saveDraft(
  state: WorkflowState,
  owner: string,
  id: string,
  revision: number,
  content: PlannerPackage,
): WorkflowState {
  const draft = state.drafts[owner];
  if (!draft || draft.id !== id || draft.revision !== revision)
    throw Error(
      "This draft changed in another session. Your open edits are retained. Reload the saved draft before continuing.",
    );
  const next = copy(state);
  next.drafts[owner] = {
    ...draft,
    content: copy(content),
    revision: revision + 1,
    savedAt: new Date().toISOString(),
  };
  return next;
}
export function validatePackage(p: PlannerPackage) {
  for (const [path, content] of Object.entries({
    ...Object.fromEntries(
      Object.entries(p.files).map(([k, v]) => ["skills/" + k, v]),
    ),
    ...Object.fromEntries(
      Object.entries(p.workerFiles).map(([k, v]) => [
        "worker-registry/" + k,
        v,
      ]),
    ),
  })) {
    const error = validateFile(path, content);
    if (error) throw Error(path + ": " + error);
  }
  if (!Object.keys(p.files).length)
    throw Error("The Planner needs at least one skill file.");
  for (const prompt of p.prompts)
    if (!prompt.name.trim() || !prompt.content.trim())
      throw Error("Prompt names and contents are required.");
  if (
    new Set(p.prompts.map((x) => x.id)).size !== p.prompts.length ||
    new Set(p.models.map((x) => x.id)).size !== p.models.length
  )
    throw Error("Duplicate prompt or model IDs.");
  if (p.modelIds.some((id) => !p.models.some((m) => m.id === id)))
    throw Error("A model assignment references a missing profile.");
  for (const m of p.models) {
    if (!m.name.trim() || !m.provider.trim())
      throw Error("Model name and provider are required.");
    if (
      !Number.isFinite(m.timeout) ||
      m.timeout <= 0 ||
      !Number.isInteger(m.retries) ||
      m.retries < 0
    )
      throw Error("Check model timeout and retries.");
    if (
      m.kind === "Language model" &&
      (![m.temperature, m.topP, m.maxTokens].every(Number.isFinite) ||
        m.temperature < 0 ||
        m.temperature > 2 ||
        m.topP < 0 ||
        m.topP > 1 ||
        m.maxTokens < 1)
    )
      throw Error("Check model generation settings.");
    if (
      m.kind === "Embedding" &&
      (!Number.isInteger(m.dimensions) ||
        m.dimensions < 1 ||
        !Number.isInteger(m.batchSize) ||
        m.batchSize < 1)
    )
      throw Error("Check embedding dimensions and batch size.");
  }
}
export function publishDraft(
  state: WorkflowState,
  owner: string,
  summary: string,
): WorkflowState {
  const draft = state.drafts[owner];
  if (!draft) throw Error("Create a draft before publishing.");
  if (draft.baselineId !== state.development.publicationId)
    throw Error(
      "A newer version is available. Review and update your draft before publishing.",
    );
  validatePackage(draft.content);
  if (!changes(draft.baseline, draft.content).length)
    throw Error("Make a change before publishing a snapshot.");
  const next = copy(state);
  next.publications.push({
    id:
      "planner-pub-" +
      String(13 + state.publications.length - 1).padStart(3, "0"),
    baselineId: draft.baselineId,
    baselineVersion: draft.baselineVersion,
    baseline: copy(draft.baseline),
    content: copy(draft.content),
    author: owner,
    summary: summary.trim() || "Planner package update",
    createdAt: new Date().toISOString(),
    sourceDraftId: draft.id,
  });
  const publication = next.publications.at(-1)!;
  next.development = {
    version: state.development.version + 1,
    publicationId: publication.id,
    content: copy(publication.content),
  };
  next.releases.push({
    publicationId: publication.id,
    version: next.development.version,
    at: publication.createdAt,
  });
  delete next.drafts[owner];
  return next;
}
export function simulateAdvance(state: WorkflowState): WorkflowState {
  let next = copy(state);
  const owner = "Release automation";
  next = createDraft(next, owner);
  const first = Object.keys(next.development.content.files)[0];
  next.drafts[owner].content.files[first] +=
    "\n\n## Development update " +
    (state.development.version + 1) +
    "\nConfirm the requested reporting period before planning.\n";
  next = publishDraft(
    next,
    owner,
    "Reporting-period guidance from another user",
  );
  return next;
}
export function artefacts(p: PlannerPackage): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(p.files).map(([k, v]) => ["skills/" + k, v]),
    ),
    ...Object.fromEntries(
      Object.entries(p.workerFiles).map(([k, v]) => [
        "worker-registry/" + k,
        v,
      ]),
    ),
    ...Object.fromEntries(
      p.prompts.map((x) => [
        "prompts/" + encodeURIComponent(x.id) + ".json",
        JSON.stringify(x, null, 2),
      ]),
    ),
    ...Object.fromEntries(
      p.models.map((x) => [
        "models/" + encodeURIComponent(x.id) + ".json",
        JSON.stringify(x, null, 2),
      ]),
    ),
    "model-assignments.json": JSON.stringify(p.modelIds, null, 2),
  };
}
export function changes(a: PlannerPackage, b: PlannerPackage) {
  const before = artefacts(a),
    after = artefacts(b);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .filter((k) => before[k] !== after[k])
    .map((path) => ({
      path,
      before: before[path],
      after: after[path],
      kind:
        before[path] === undefined
          ? "Added"
          : after[path] === undefined
            ? "Deleted"
            : "Modified",
    }));
}
export function mergePlan(
  base: PlannerPackage,
  mine: PlannerPackage,
  latest: PlannerPackage,
) {
  const b = artefacts(base),
    m = artefacts(mine),
    l = artefacts(latest),
    merged: Record<string, string> = {},
    conflicts: string[] = [];
  for (const path of new Set([
    ...Object.keys(b),
    ...Object.keys(m),
    ...Object.keys(l),
  ])) {
    let value: string | undefined;
    if (m[path] === b[path]) value = l[path];
    else if (l[path] === b[path] || m[path] === l[path]) value = m[path];
    else {
      conflicts.push(path);
      value = m[path];
    }
    if (value !== undefined) merged[path] = value;
  }
  return { merged, conflicts, base: b, mine: m, latest: l };
}
export function packageFromArtefacts(
  entries: Record<string, string>,
): PlannerPackage {
  const p: PlannerPackage = {
    files: {},
    workerFiles: {},
    prompts: [],
    models: [],
    modelIds: JSON.parse(entries["model-assignments.json"] || "[]"),
  };
  for (const [path, value] of Object.entries(entries)) {
    if (path.startsWith("skills/")) p.files[path.slice(7)] = value;
    else if (path.startsWith("worker-registry/"))
      p.workerFiles[path.slice(16)] = value;
    else if (path.startsWith("prompts/")) p.prompts.push(JSON.parse(value));
    else if (path.startsWith("models/")) p.models.push(JSON.parse(value));
  }
  validatePackage(p);
  return p;
}
