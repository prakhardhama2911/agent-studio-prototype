import type { Agent, ModelProfile, StudioData } from "./types";
import snapshot from "./repository-snapshot.json";
import skillSnapshot from "./subagent-skill-packages.json";
const language: ModelProfile = {
  id: "language-shared",
  name: "Shared reasoning model",
  kind: "Language model",
  provider: "Azure OpenAI",
  model: "Not provided",
  version: "Not provided",
  deployment: "Not provided",
  endpoint: "https://your-resource.openai.azure.com",
  apiVersion: "Not provided",
  client: "LangChain / Azure client",
  credentialRef: "AZURE_OPENAI_API_KEY",
  timeout: 120,
  retries: 2,
  temperature: 0.2,
  topP: 1,
  maxTokens: 8192,
  reasoning: "medium",
  dimensions: 0,
  batchSize: 0,
};
const embedding: ModelProfile = {
  ...language,
  id: "embedding-shared",
  name: "Worker catalog embeddings",
  kind: "Embedding",
  model: "Not provided",
  deployment: "Not provided",
  client: "Azure embeddings client",
  dimensions: 1536,
  batchSize: 32,
};
const spec = [
  {
    id: "pqa-analysis",
    backendId: "distribution",
    groupId: "distribution",
    name: "PQA Analysis",
    description:
      "Identify distribution opportunities and Hero SKUs through performance quadrant analysis.",
    scope:
      "Relative sales value · Weighted distribution · Country · Category · Brand · SKU",
  },
  {
    id: "ad-hoc-analysis",
    backendId: "general-data",
    groupId: "general-data",
    name: "Ad-hoc Dataset Analysis",
    description:
      "Answer question-driven requests using schema-grounded analytical evidence.",
    scope:
      "Question-driven metrics · Validated schema · Catalog-authorized entities",
  },
  {
    id: "category-market-segments",
    backendId: "market-overview",
    groupId: "market-overview",
    name: "Category: Market Segments",
    description:
      "Review category size, segment share, growth, and the structure of a selected market.",
    scope:
      "Category sales · Market share · Growth · Country · Category · Segment",
  },
];
const workers = spec.map((a) => ({
  id: `worker--${a.backendId}--${a.id}`,
  agentId: a.id,
  name: a.name,
  description: a.description,
  routing:
    a.id === "pqa-analysis"
      ? "PQA\nDistribution opportunities\nHero SKUs"
      : a.id === "ad-hoc-analysis"
        ? "Custom dataset question\nSales ranking\nCompare performance"
        : "Market overview\nSegment size and share",
  examples:
    a.id === "pqa-analysis"
      ? "Find brands with strong sales but weak distribution.\nIdentify Hero SKUs in the selected category."
      : `Run ${a.name.toLowerCase()} for the selected country and category.`,
  exclusions:
    a.id === "pqa-analysis"
      ? "Ordinary sales rankings without distribution analysis.\nQ1 calendar-quarter sales totals."
      : "Requests outside the registered analytical scope.",
  metrics:
    a.id === "pqa-analysis"
      ? "relative-sales-value\nweighted-distribution\nincremental-sales-opportunity"
      : "See repository definition for registered metrics.",
  dimensions: "country\ncategory\nbrand",
  requiredInputs:
    "country: one authorized catalog entity\ncategory: one authorized catalog entity",
  defaults:
    a.id === "pqa-analysis"
      ? "metric: relative-sales-value\ngrain: brand"
      : "Use registered defaults only.",
  limitations:
    "Preserve authorized scope. Report unavailable evidence instead of inventing values.",
  source: `worker-registry/worker--${a.backendId}--${a.id}.md`,
}));
const coordinator: Agent = {
  id: "coordinator",
  name: "Coordinator",
  role: "coordinator",
  description:
    "Orchestrates analysis execution, delegates approved tasks to specialist agents, and brings their results together.",
  scope: "",
  instructions: "",
  files: {},
  prompts: [],
  modelIds: [],
  origin: "Demo example",
};
const planner: Agent = {
  id: "planner",
  name: "Planner",
  role: "planner",
  description:
    "Turns a business question into a validated plan using the registered worker catalog.",
  scope:
    "Worker discovery · Entity resolution · Semantic review · Plan validation",
  instructions:
    "Select the minimum sufficient workers. Confirm metrics, grain, and authorized entities before submitting a plan.",
  files: snapshot.plannerSkills,
  prompts: [
    {
      id: "planner-system",
      name: "Planning system prompt",
      purpose:
        "Static repository prompt. Runtime also appends limits, mandatory policy, and conditional guidance.",
      content: snapshot.plannerPrompt,
      composed: true,
    },
    {
      id: "planner-handoff",
      name: "Request context",
      purpose: "Request context for planning.",
      content:
        "Business question: {{question}}\nAuthorized scope: {{scope}}\n\nDiscover candidate workers, validate entity scope, then submit the minimum sufficient plan.",
    },
  ],
  modelIds: ["language-shared", "embedding-shared"],
  origin: "Repository example",
  source: "app/agents/planner/graph.py",
};
export const seed: StudioData = {
  groups: [
    {
      id: "distribution",
      name: "Distribution Strategist",
      description:
        "Diagnoses availability and weighted distribution opportunities.",
      color: "#6772ff",
    },
    {
      id: "general-data",
      name: "General Data Analyst",
      description: "Answers arbitrary questions grounded in your data.",
      color: "#8b69cf",
    },
    {
      id: "market-overview",
      name: "Market Overview",
      description: "Market Overview — Category",
      color: "#c90019",
    },
  ],
  agents: [
    coordinator,
    planner,
    ...spec.map((a) => ({
      ...a,
      role: "worker" as const,
      skillId: a.id,
      instructions:
        a.description +
        " Preserve validated inputs and report evidence limitations.",
      files: {
        "SKILL.md": `# ${a.name}\n\n${a.description}\n\n## Execution\nUse validated country and category inputs. Preserve the selected metric and grain.\n\n## Evidence\nReturn evidence-backed results and state limitations.`,
      },
      prompts: [
        {
          id: `${a.id}-system`,
          name: "Worker system instructions",
          purpose:
            "Worker instructions for execution context and evidence constraints.",
          content: `You are the ${a.name} worker.\n\nTask: {{question}}\nScope: {{scope}}\n\nExecute only the approved analysis. Apply the skill instructions and registered definition. Return supported findings, source evidence, and limitations.`,
          composed: true,
        },
      ],
      modelIds: ["language-shared"],
      origin: "Demo example" as const,
    })),
  ],
  workers: workers.map((w) => ({
    ...w,
    ...snapshot.workerDetails[
      w.source.split("/").pop() as keyof typeof snapshot.workerDetails
    ],
  })),
  models: [language, embedding],
};
type SavedSkillPackage = {
  agentId: string;
  skillId: string;
  name: string;
  files: Record<string, string>;
};
const savedPackages = skillSnapshot.packages as Record<
  string,
  SavedSkillPackage
>;

// Upgrade only old example files; retain the user's own edits and imported files.
export function hydrateSampleSkills(data: StudioData): StudioData {
  return {
    ...data,
    agents: data.agents.map((agent) => {
      if (
        agent.role !== "worker" ||
        agent.origin === "Live" ||
        agent.skillOrigin === "Database snapshot"
      )
        return agent;
      const packageData = savedPackages[agent.skillId || agent.id];
      const previousExample = seed.agents.find((a) => a.id === agent.id);
      if (
        !packageData ||
        packageData.agentId !== agent.backendId ||
        !previousExample
      )
        return agent;
      const files = { ...packageData.files };
      for (const [path, content] of Object.entries(agent.files)) {
        if (previousExample.files[path] !== content) files[path] = content;
      }
      return { ...agent, files, skillOrigin: "Database snapshot" as const };
    }),
  };
}
export const freshSeed = (): StudioData =>
  hydrateSampleSkills(structuredClone(seed));
