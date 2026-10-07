import type { Agent, StudioData } from "./types";
import {
  copy,
  initialWorkflow,
  packageFrom,
  createDraft,
  saveDraft,
  publishDraft,
  simulateAdvance,
  changes,
  WORKFLOW_KEY,
} from "./agentWorkflow.ts";
import type { AgentPackage, WorkflowState, Publication } from "./agentWorkflow";

export const DEMO_USERS = [
  { id: "prakhar", name: "Prakhar" },
  { id: "maya", name: "Maya" },
];
export const agentCapabilities = (role: Agent["role"]) => ({
  workerDefinitions: role === "planner",
});
export const workflowStorageKey = (catalogId: string, agentId: string) =>
  `alchemy-studio:agent-workflow:v2:${encodeURIComponent(catalogId)}:${encodeURIComponent(agentId)}`;
export type DraftRef = { owner: string; id: string; revision: number };
export interface AgentWorkflowService {
  load(): Promise<WorkflowState>;
  loadActive(): Promise<WorkflowState["development"]>;
  loadDraft(
    owner: string,
  ): Promise<WorkflowState["drafts"][string] | undefined>;
  listPublications(): Promise<Publication[]>;
  createDraft(owner: string, publicationId?: string): Promise<WorkflowState>;
  saveDraft(ref: DraftRef, content: AgentPackage): Promise<WorkflowState>;
  reviewDraft(ref: DraftRef, content: AgentPackage): Promise<WorkflowState>;
  discardDraft(ref: DraftRef): Promise<WorkflowState>;
  publish(ref: DraftRef, summary: string): Promise<WorkflowState>;
  updateDraft(
    ref: DraftRef,
    targetId: string,
    content: AgentPackage,
  ): Promise<WorkflowState>;
  subscribe(listener: () => void): () => void;
  tourSeen(owner: string): Promise<boolean>;
  markTourSeen(owner: string): Promise<void>;
  simulateUpdate(): Promise<WorkflowState>;
  reset(): Promise<WorkflowState>;
}

type StoragePort = Pick<Storage, "getItem" | "setItem">;
type Options = {
  catalogId: string;
  agent: Agent;
  data: StudioData;
  workerFiles: Record<string, string>;
  storage?: StoragePort;
};
// UI consumes this factory/interface. A future API adapter replaces this browser implementation.
export function createAgentWorkflowService(
  options: Options,
): AgentWorkflowService {
  const { catalogId, agent, data, workerFiles } = options;
  const storage = options.storage ?? localStorage;
  const key = workflowStorageKey(catalogId, agent.id);
  const planner = agentCapabilities(agent.role).workerDefinitions;
  const role = planner ? "planner" : "worker";
  const seed = initialWorkflow(
    packageFrom(data, agent, workerFiles),
    agent.id,
    role,
  );
  const normalizePackage = (value: AgentPackage): AgentPackage => {
    if (
      !value ||
      !value.files ||
      !Array.isArray(value.prompts) ||
      !Array.isArray(value.models) ||
      !Array.isArray(value.modelIds)
    )
      throw Error(
        "Saved package could not be read. Your stored data has been preserved.",
      );
    const p = copy(value);
    if (!planner) delete p.workerFiles;
    else p.workerFiles ??= {};
    return p;
  };
  const normalize = (value: WorkflowState): WorkflowState => {
    if (
      value?.schema !== 1 ||
      !value.development?.content ||
      !value.drafts ||
      !Array.isArray(value.publications) ||
      !Array.isArray(value.releases)
    )
      throw Error(
        "Saved workflow could not be read. Your stored data has been preserved.",
      );
    if (value.agentId && value.agentId !== agent.id)
      throw Error("This saved package belongs to a different agent.");
    const next = copy(value);
    next.agentId = agent.id;
    next.role = role;
    next.development.content = normalizePackage(next.development.content);
    for (const d of Object.values(next.drafts)) {
      d.content = normalizePackage(d.content);
      d.baseline = normalizePackage(d.baseline);
    }
    for (const p of next.publications) {
      p.content = normalizePackage(p.content);
      p.baseline = normalizePackage(p.baseline);
    }
    return next;
  };
  const notify = () => {
    if (typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("agent-workflow-change", { detail: key }),
      );
  };
  const write = (next: WorkflowState) => {
    const value = normalize(next);
    storage.setItem(key, JSON.stringify(value));
    // Projection is a cache; a failed cache write must not turn a successful publication into an error.
    try {
      storage.setItem(
        key + ":active-summary",
        JSON.stringify(packageSummary(value.development.content)),
      );
    } catch {}
    notify();
    return copy(value);
  };
  const read = (): WorkflowState => {
    const raw = storage.getItem(key);
    if (raw) return normalize(JSON.parse(raw));
    let next = copy(seed);
    // Legacy Planner state was global to the bundled catalog. Never migrate it into a live catalog.
    const legacy =
      planner && catalogId === "alchemy-studio:v1:sample"
        ? storage.getItem(WORKFLOW_KEY)
        : null;
    if (legacy) {
      next = normalize(JSON.parse(legacy));
      for (const user of DEMO_USERS) {
        if (next.drafts[user.name] && !next.drafts[user.id]) {
          next.drafts[user.id] = { ...next.drafts[user.name], owner: user.id };
          delete next.drafts[user.name];
        }
      }
    } else if (!planner && agent.publishedConfiguration) {
      const baseline = normalizePackage(
        JSON.parse(agent.publishedConfiguration),
      );
      next = initialWorkflow(baseline, agent.id, role);
      if (agent.publishedAt) next.publications[0].createdAt = agent.publishedAt;
      if (changes(baseline, seed.development.content).length) {
        next = createDraft(next, DEMO_USERS[0].id);
        next.drafts[DEMO_USERS[0].id].content = copy(seed.development.content);
      }
    }
    // Write new state only after migration succeeds. Legacy keys are retained for recovery.
    return write(next);
  };
  const assertRef = (s: WorkflowState, ref: DraftRef) => {
    const d = s.drafts[ref.owner];
    if (!d || d.id !== ref.id || d.revision !== ref.revision)
      throw Error(
        "This draft changed in another session. Your open edits are retained. Reload the saved draft before continuing.",
      );
    return d;
  };
  const assertPackage = (content: AgentPackage) => {
    if (
      !planner &&
      content.workerFiles &&
      Object.keys(content.workerFiles).length
    )
      throw Error("Worker definitions belong to Planner only.");
    return normalizePackage(content);
  };
  // Browser lock serializes the read/check/write transaction across tabs, not user editing sessions.
  let queue: Promise<unknown> = Promise.resolve();
  const transaction = (fn: () => WorkflowState): Promise<WorkflowState> => {
    const run = async () => {
      if (typeof window !== "undefined" && navigator.locks)
        return navigator.locks.request(key, fn);
      return fn();
    };
    const pending = queue.then(run, run);
    queue = pending.catch(() => {});
    return pending;
  };
  const mutate = (fn: (state: WorkflowState) => WorkflowState) =>
    transaction(() => write(fn(read())));
  const tourKey = (owner: string) => `${key}:tour:${encodeURIComponent(owner)}`;
  const service: AgentWorkflowService = {
    load: () => transaction(read),
    loadActive: async () => (await service.load()).development,
    loadDraft: async (owner) => (await service.load()).drafts[owner],
    listPublications: async () => (await service.load()).publications,
    createDraft: (owner, publicationId) =>
      mutate((s) => {
        const p = publicationId
          ? s.publications.find((p) => p.id === publicationId)
          : undefined;
        if (publicationId && !p)
          throw Error("Publication was not found. Reload version history.");
        return createDraft(s, owner, p);
      }),
    saveDraft: (ref, content) =>
      mutate((s) =>
        saveDraft(s, ref.owner, ref.id, ref.revision, assertPackage(content)),
      ),
    reviewDraft: (ref, content) =>
      mutate((s) => {
        const next = saveDraft(
          s,
          ref.owner,
          ref.id,
          ref.revision,
          assertPackage(content),
        );
        next.drafts[ref.owner].reviewedRevision =
          next.drafts[ref.owner].revision;
        return next;
      }),
    discardDraft: (ref) =>
      mutate((s) => {
        assertRef(s, ref);
        const next = copy(s);
        delete next.drafts[ref.owner];
        return next;
      }),
    publish: (ref, summary) =>
      mutate((s) => {
        const d = assertRef(s, ref);
        if (d.reviewedRevision !== d.revision)
          throw Error("Review your latest changes before publishing.");
        return publishDraft(s, ref.owner, summary);
      }),
    updateDraft: (ref, targetId, content) =>
      mutate((s) => {
        if (s.development.publicationId !== targetId)
          throw Error(
            "Development advanced again. Cancel and reopen the update.",
          );
        const next = saveDraft(
          s,
          ref.owner,
          ref.id,
          ref.revision,
          assertPackage(content),
        );
        Object.assign(next.drafts[ref.owner], {
          baselineId: targetId,
          baselineVersion: s.development.version,
          baseline: copy(s.development.content),
          reviewedRevision: undefined,
        });
        return next;
      }),
    subscribe: (listener) => {
      if (typeof window === "undefined") return () => {};
      const storageListener = (e: StorageEvent) => {
        if (e.key === key || e.key === null) listener();
      };
      const localListener = (e: Event) => {
        if ((e as CustomEvent).detail === key) listener();
      };
      window.addEventListener("storage", storageListener);
      window.addEventListener("agent-workflow-change", localListener);
      return () => {
        window.removeEventListener("storage", storageListener);
        window.removeEventListener("agent-workflow-change", localListener);
      };
    },
    tourSeen: async (owner) =>
      storage.getItem(tourKey(owner)) === "seen" ||
      (planner &&
        catalogId === "alchemy-studio:v1:sample" &&
        storage.getItem("alchemy-studio:planner-tour:v1") === "seen"),
    markTourSeen: async (owner) => {
      storage.setItem(tourKey(owner), "seen");
    },
    simulateUpdate: () => mutate(simulateAdvance),
    reset: () => transaction(() => write(seed)),
  };
  return service;
}

export type ActiveSummary = { files: number; prompts: number; models: number };
export const packageSummary = (content: AgentPackage): ActiveSummary => ({
  files: Object.keys(content.files).length,
  prompts: content.prompts.length,
  models: content.modelIds.length,
});
// Lightweight catalog projection; full draft/publication histories are loaded only on opening an agent.
export async function loadActiveSummaries(
  catalogId: string,
  agentIds: string[],
  storage: StoragePort = localStorage,
): Promise<Record<string, ActiveSummary>> {
  const result: Record<string, ActiveSummary> = {};
  for (const id of agentIds) {
    const raw = storage.getItem(
      workflowStorageKey(catalogId, id) + ":active-summary",
    );
    if (raw) {
      try {
        result[id] = JSON.parse(raw);
      } catch {}
    }
  }
  return result;
}
