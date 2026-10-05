export function allowedRead(method, path) {
  return (
    method === "GET" &&
    /^\/api\/(?:bootstrap|agents\/[^/?]+|agent-studio\/skill-packages\/[^/?]+\/[^/?]+)$/.test(
      path,
    )
  );
}
export function validatePath(path) {
  return (
    !!path &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").some((x) => !x || x === ".." || x === ".") &&
    /\.(md|json|ya?ml|txt|csv)$/i.test(path)
  );
}
export function validateFile(path, content) {
  if (!validatePath(path))
    return "Use a relative path ending in .md, .json, .yaml, .yml, .txt or .csv.";
  if (!content.trim()) return "File content cannot be empty.";
  if (path.endsWith(".json")) {
    try {
      JSON.parse(content);
    } catch {
      return "Fix the JSON syntax before saving.";
    }
  }
  return "";
}
export function exportDocument(data) {
  return JSON.stringify(
    {
      format: "alchemy-studio-prototype",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}
export function parseDocument(text) {
  const d = JSON.parse(text);
  if (d.format !== "alchemy-studio-prototype" || d.version !== 1)
    throw Error("Choose a version 1 Agent Studio configuration export.");
  const v = d.data;
  if (
    !v ||
    !["agents", "groups", "workers", "models"].every((k) => Array.isArray(v[k]))
  )
    throw Error("The export is missing configuration collections.");
  const string = (x) => typeof x === "string";
  const strings = (v, keys) => keys.every((k) => string(v[k]));
  if (
    !v.groups.every((g) =>
      strings(g, ["id", "name", "description", "color"]),
    ) ||
    !v.agents.every(
      (a) =>
        strings(a, [
          "id",
          "name",
          "description",
          "scope",
          "instructions",
          "origin",
        ]) &&
        ["coordinator", "planner", "worker"].includes(a.role) &&
        a.files &&
        typeof a.files === "object" &&
        !Array.isArray(a.files) &&
        Object.entries(a.files).every(
          ([p, c]) => validatePath(p) && string(c),
        ) &&
        (a.workerFiles === undefined ||
          (a.workerFiles &&
            typeof a.workerFiles === "object" &&
            !Array.isArray(a.workerFiles) &&
            Object.entries(a.workerFiles).every(
              ([p, c]) => validatePath(p) && string(c),
            ))) &&
        Array.isArray(a.modelIds) &&
        a.modelIds.every(string) &&
        Array.isArray(a.prompts) &&
        a.prompts.every((p) =>
          strings(p, ["id", "name", "purpose", "content"]),
        ),
    ) ||
    !v.workers.every((w) =>
      strings(w, [
        "id",
        "agentId",
        "name",
        "description",
        "routing",
        "examples",
        "exclusions",
        "metrics",
        "dimensions",
        "requiredInputs",
        "defaults",
        "limitations",
        "source",
      ]),
    ) ||
    !v.models.every(
      (m) =>
        strings(m, [
          "id",
          "name",
          "provider",
          "model",
          "version",
          "deployment",
          "endpoint",
          "apiVersion",
          "client",
          "credentialRef",
          "reasoning",
        ]) &&
        ["Language model", "Embedding"].includes(m.kind) &&
        [
          "timeout",
          "retries",
          "temperature",
          "topP",
          "maxTokens",
          "dimensions",
          "batchSize",
        ].every((k) => Number.isFinite(m[k])),
    )
  )
    throw Error("The export contains invalid records.");
  for (const k of ["agents", "groups", "workers", "models"])
    if (new Set(v[k].map((x) => x.id)).size !== v[k].length)
      throw Error("The export contains duplicate IDs.");
  if (
    v.agents.some(
      (a) =>
        a.modelIds.some((id) => !v.models.some((m) => m.id === id)) ||
        (a.groupId && !v.groups.some((g) => g.id === a.groupId)),
    ) ||
    v.workers.some((w) => !v.agents.some((a) => a.id === w.agentId))
  )
    throw Error("The export contains broken agent or model references.");
  // Update only known legacy fixture copy, preserving user-authored content.
  v.agents = v.agents.map((agent) => ({
    ...agent,
    prompts: agent.prompts.map((prompt) => ({
      ...prompt,
      purpose: prompt.purpose
        .replace(
          "Demo request template for previewing planner inputs.",
          "Request context for planning.",
        )
        .replace(
          "Demo worker prompt showing execution context and evidence constraints.",
          "Worker instructions for execution context and evidence constraints.",
        ),
    })),
    files: Object.fromEntries(
      Object.entries(agent.files)
        .filter(
          ([path]) =>
            agent.role !== "worker" ||
            path !== "references/worker-definition.md",
        )
        .map(([path, content]) => [
          path,
          content.replace(
            "\n\n> Demo skill. Connect to the backend to inspect the saved DB package.",
            "",
          ),
        ]),
    ),
  }));
  v.models = v.models.map((model) => ({
    ...model,
    name: ["Reasoning model", "Shared reasoning model"].includes(model.name)
      ? v.agents.filter(
          (agent) =>
            agent.role !== "coordinator" && agent.modelIds.includes(model.id),
        ).length > 1
        ? "Shared reasoning model"
        : "Reasoning model"
      : model.name,
    deployment: ["alchemy-reasoning-demo", "alchemy-embeddings-demo"].includes(
      model.deployment,
    )
      ? "Not provided"
      : model.deployment,
  }));
  // Older browser drafts and imports may still contain Coordinator configuration.
  // Retain its catalog identity, but it is now presentation-only.
  return {
    ...v,
    agents: v.agents.map((a) =>
      a.role === "coordinator"
        ? {
            ...a,
            scope: "",
            instructions: "",
            files: {},
            prompts: [],
            modelIds: [],
          }
        : a,
    ),
  };
}
export function saveDraft(storage, key, data) {
  storage.setItem(key, exportDocument(data));
}
export function loadDraft(storage, key) {
  const raw = storage.getItem(key);
  return raw ? parseDocument(raw) : null;
}
export function identityScope(token) {
  if (!token) return "anonymous";
  try {
    const p = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!p.sub && !p.oid) throw Error();
    return JSON.stringify([p.iss, p.tid, p.tenant_id, p.sub || p.oid]);
  } catch {
    throw Error(
      "Enter a valid JWT access token, or leave the field empty for an unauthenticated local backend.",
    );
  }
}

// Keep model edits agent-specific even when the initial catalog reuses a profile.
export function editAssignedModel(data, agentId, modelId, changes, nextId) {
  const agent = data.agents.find((item) => item.id === agentId);
  const model = data.models.find((item) => item.id === modelId);
  if (!agent || !model || !agent.modelIds.includes(modelId)) {
    throw Error("The selected model is not assigned to this agent.");
  }
  const shared = data.agents.some(
    (item) => item.id !== agentId && item.modelIds.includes(modelId),
  );
  const selectedId = shared ? nextId : modelId;
  const updated = {
    ...model,
    name:
      shared && model.name === "Shared reasoning model"
        ? "Reasoning model"
        : model.name,
    ...changes,
    id: selectedId,
  };
  return {
    selectedId,
    models: shared
      ? [...data.models, updated]
      : data.models.map((item) => (item.id === modelId ? updated : item)),
    modelIds: agent.modelIds.map((id) => (id === modelId ? selectedId : id)),
  };
}
