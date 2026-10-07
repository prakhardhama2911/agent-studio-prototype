export type Role = "coordinator" | "planner" | "worker";
export type Origin =
  | "Repository example"
  | "Demo example"
  | "Database snapshot"
  | "Live"
  | "Local draft";
export interface Prompt {
  id: string;
  name: string;
  purpose: string;
  content: string;
  composed?: boolean;
}
export interface Worker {
  id: string;
  agentId: string;
  name: string;
  description: string;
  routing: string;
  examples: string;
  exclusions: string;
  metrics: string;
  dimensions: string;
  requiredInputs: string;
  defaults: string;
  limitations: string;
  source: string;
}
export interface ModelProfile {
  id: string;
  name: string;
  kind: "Language model" | "Embedding";
  provider: string;
  model: string;
  version: string;
  deployment: string;
  endpoint: string;
  apiVersion: string;
  client: string;
  credentialRef: string;
  timeout: number;
  retries: number;
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoning: string;
  dimensions: number;
  batchSize: number;
}
export interface Agent {
  id: string;
  backendId?: string;
  skillId?: string;
  name: string;
  description: string;
  role: Role;
  groupId?: string;
  scope: string;
  instructions: string;
  files: Record<string, string>;
  workerFiles?: Record<string, string>;
  skillOrigin?: Origin;
  publishedConfiguration?: string;
  publishedAt?: string;
  prompts: Prompt[];
  modelIds: string[];
  origin: Origin;
  source?: string;
}
export interface Group {
  publishedConfiguration?: string;
  publishedAt?: string;
  id: string;
  name: string;
  description: string;
  color: string;
}
export interface StudioData {
  agents: Agent[];
  groups: Group[];
  workers: Worker[];
  models: ModelProfile[];
}
