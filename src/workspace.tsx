import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUpFromLine,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  Code2,
  Copy,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Network,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Button, Dialog } from "./ui";
import { SkillPackageEditor } from "./SkillPackageEditor";
import { ModelSharingInfo } from "./ModelSharingInfo";
import type { Agent, ModelProfile, Prompt, StudioData } from "./types";
import { validateFile, validatePath, editAssignedModel } from "./lib/core.mjs";
import {
  WorkerRegistryViewer,
  defaultWorkerFiles,
} from "./WorkerRegistryViewer";
const tabs = [
  { name: "Skills", icon: FolderOpen },
  { name: "Prompts", icon: FileText },
  { name: "Worker Definitions", icon: Network },
  { name: "Models", icon: Boxes },
];
export function Workspace({
  data,
  source,
  agentId,
  onClose,
  onSave,
}: {
  data: StudioData;
  source: StudioData;
  agentId: string;
  onClose: () => void;
  onSave: (d: StudioData) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(data));
  const [saved, setSaved] = useState(() => JSON.stringify(data));
  const [tab, setTab] = useState("Skills");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const agent = draft.agents.find((a) => a.id === agentId)!;
  const visibleTabs = tabs.filter(
    (item) => agent.role !== "worker" || item.name !== "Worker Definitions",
  );
  const dirty = JSON.stringify(draft) !== saved;
  const updateAgent = (patch: Partial<Agent>) =>
    setDraft((d) => ({
      ...d,
      agents: d.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a)),
    }));
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const close = () => {
    if (!dirty || confirm("Discard unsaved changes and close this workspace?"))
      onClose();
  };
  const save = () => {
    try {
      for (const a of draft.agents) {
        for (const [p, c] of Object.entries({
          ...a.files,
          ...Object.fromEntries(
            Object.entries(a.workerFiles ?? {}).map(([path, content]) => [
              `worker-registry/${path}`,
              content,
            ]),
          ),
        })) {
          const e = validateFile(p, c);
          if (e) throw Error(`${a.name} / ${p}: ${e}`);
        }
        for (const p of a.prompts)
          if (!p.name.trim() || !p.content.trim())
            throw Error("Prompt names and content are required.");
      }
      for (const m of draft.models) {
        if (!m.name.trim() || !m.provider.trim())
          throw Error("Model profile name and provider are required.");
        if (m.timeout <= 0 || m.retries < 0 || !Number.isInteger(m.retries))
          throw Error(
            "Timeout must be positive and retries must be a non-negative integer.",
          );
        if (
          m.kind === "Language model" &&
          (m.temperature < 0 ||
            m.temperature > 2 ||
            m.topP < 0 ||
            m.topP > 1 ||
            m.maxTokens < 1)
        )
          throw Error(
            "Check generation settings: temperature 0–2, top P 0–1, output tokens at least 1.",
          );
        if (m.kind === "Embedding" && (m.dimensions < 1 || m.batchSize < 1))
          throw Error("Embedding dimensions and batch size must be positive.");
      }
      const next = {
        ...draft,
        agents: draft.agents.map((a) =>
          a.id === agentId ? { ...a, origin: "Local draft" as const } : a,
        ),
      };
      onSave(next);
      setDraft(next);
      setSaved(JSON.stringify(next));
      setError("");
      setStatus("Changes saved");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const count = (name: string) =>
    name === "Skills"
      ? Object.keys(agent.files).length
      : name === "Prompts"
        ? agent.prompts.length
        : name === "Worker Definitions"
          ? agent.role === "worker"
            ? draft.workers.filter((w) => w.agentId === agent.id).length
            : Object.keys(agent.workerFiles ?? defaultWorkerFiles).length
          : name === "Models"
            ? agent.modelIds.length
            : null;
  return (
    <Dialog
      title={agent.name}
      eyebrow={`AGENT STUDIO / ${agent.role === "worker" ? "SUB-AGENT" : agent.role.toUpperCase()} CONFIGURATION`}
      onClose={close}
      wide
    >
      <div className="workspace-summary">
        <div className={`workspace-symbol ${agent.role}`}>
          <Network size={24} />
        </div>
        <div>
          <div className="summary-badges">
            <Badge tone="green">
              {agent.role === "worker" ? "Planner selectable" : agent.role}
            </Badge>
            {agent.groupId && (
              <Badge tone="neutral">
                {draft.groups.find((group) => group.id === agent.groupId)
                  ?.name || "Analysis group"}
              </Badge>
            )}
            {dirty && <Badge tone="amber">Unsaved changes</Badge>}
          </div>
          <p>{agent.description}</p>
        </div>
        <span className="workspace-id">{agent.id}</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Agent configuration">
        {visibleTabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            id={`tab-${name.replaceAll(" ", "-")}`}
            role="tab"
            aria-selected={tab === name}
            aria-controls="workspace-panel"
            tabIndex={tab === name ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const index =
                  (visibleTabs.findIndex((t) => t.name === tab) +
                    (e.key === "ArrowRight" ? 1 : -1) +
                    visibleTabs.length) %
                  visibleTabs.length;
                setTab(visibleTabs[index].name);
                document
                  .getElementById(
                    `tab-${visibleTabs[index].name.replaceAll(" ", "-")}`,
                  )
                  ?.focus();
              }
            }}
            onClick={() => {
              setTab(name);
              setError("");
            }}
            className={tab === name ? "selected" : ""}
          >
            <Icon size={16} />
            {name}
            {count(name) !== null && <span>{count(name)}</span>}
          </button>
        ))}
      </div>
      <div
        className="workspace-body"
        role="tabpanel"
        id="workspace-panel"
        aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`}
      >
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {tab === "Skills" && (
          <SkillPackageEditor
            downloadable
            downloadPrefix={agent.id}
            files={agent.files}
            onChange={(files) => updateAgent({ files })}
            source={agent.skillOrigin || agent.origin}
            setError={setError}
          />
        )}
        {tab === "Prompts" && (
          <PromptEditor
            prompts={agent.prompts}
            onChange={(prompts) => updateAgent({ prompts })}
            role={agent.role}
            source={agent.source}
          />
        )}
        {tab === "Worker Definitions" && agent.role === "planner" && (
          <WorkerRegistryViewer
            files={agent.workerFiles ?? defaultWorkerFiles}
            onChange={(workerFiles) => updateAgent({ workerFiles })}
            setError={setError}
          />
        )}
        {tab === "Models" && (
          <Models
            agent={agent}
            data={draft}
            onChange={(models) => setDraft((d) => ({ ...d, models }))}
            onAssign={(modelIds) => updateAgent({ modelIds })}
          />
        )}
      </div>
      <footer className="workspace-footer">
        <span className={dirty ? "dirty-indicator" : "saved-indicator"}>
          {dirty ? <span className="status-dot" /> : <ShieldCheck size={15} />}{" "}
          {dirty ? "Unsaved changes" : status || "All changes saved"}
        </span>
        <div>
          <Button
            onClick={() => {
              if (!dirty || confirm("Discard changes since the last save?")) {
                setDraft(JSON.parse(saved));
                setError("");
                setStatus("Changes discarded");
              }
            }}
            disabled={!dirty}
          >
            Discard changes
          </Button>
          <Button primary onClick={save} disabled={!dirty}>
            <Save size={15} />
            Save changes
          </Button>
        </div>
      </footer>
    </Dialog>
  );
}
function PromptEditor({
  prompts,
  onChange,
  role,
  source,
}: {
  prompts: Prompt[];
  onChange: (p: Prompt[]) => void;
  role: string;
  source?: string;
}) {
  const [id, setId] = useState(prompts[0]?.id || "");
  const [preview, setPreview] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    question: "Identify Hero SKUs and distribution opportunities.",
    scope: "United Kingdom · Womens Intimate Health",
  });
  const p = prompts.find((p) => p.id === id) || prompts[0];
  const variables = Array.from(
    new Set(p?.content.match(/\{\{\s*[\w.]+\s*\}\}/g) || []),
  );
  const patch = (v: Partial<Prompt>) =>
    onChange(prompts.map((x) => (x.id === p.id ? { ...x, ...v } : x)));
  return (
    <>
      <div className="section-title">
        <div>
          <h3>Prompts & instructions</h3>
          <p>Shape how this {role} interprets context and responds.</p>
        </div>
        <Button
          onClick={() => {
            const next = {
              id: crypto.randomUUID(),
              name: "New prompt",
              purpose: "Describe when this prompt is used.",
              content: "Task: {{question}}\nScope: {{scope}}",
            };
            onChange([...prompts, next]);
            setId(next.id);
          }}
        >
          <Plus size={15} />
          Add prompt
        </Button>
      </div>
      <div className="prompt-layout">
        <aside className="prompt-list">
          {prompts.map((x) => (
            <button
              className={p?.id === x.id ? "selected" : ""}
              key={x.id}
              onClick={() => {
                setId(x.id);
                setPreview(false);
              }}
            >
              <FileText size={17} />
              <div>
                <strong>{x.name}</strong>
                <small>
                  {x.composed ? "Runtime-composed template" : "Prompt template"}
                </small>
              </div>
              <ChevronRight size={14} />
            </button>
          ))}
          <div className="sidebar-note">
            {source ? `Static source: ${source}` : "Prompt templates"}
            <br />
            Preview the prompt with the inputs below.
          </div>
        </aside>
        {p ? (
          <section className="prompt-main">
            <div className="form-grid">
              <label>
                Prompt name
                <input
                  value={p.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>
              <label>
                Purpose
                <input
                  value={p.purpose}
                  onChange={(e) => patch({ purpose: e.target.value })}
                />
              </label>
            </div>
            {p.composed && (
              <div className="composition-note">
                <LayersIcon />
                Runtime assembles this template with policy, limits, and request
                context.
              </div>
            )}
            <div className="code-toolbar">
              <span>
                <Code2 size={15} />
                {preview ? "Prompt preview" : "Prompt content"}
              </span>
              <div>
                <button
                  className={!preview ? "active" : ""}
                  onClick={() => setPreview(false)}
                >
                  Edit
                </button>
                <button
                  className={preview ? "active" : ""}
                  onClick={() => setPreview(true)}
                >
                  <Sparkles size={13} />
                  Preview
                </button>
                <button
                  aria-label="Remove prompt"
                  onClick={() => {
                    if (confirm("Remove this prompt?")) {
                      onChange(prompts.filter((x) => x.id !== p.id));
                      setId("");
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {preview ? (
              <pre className="prompt-preview">
                {p.content.replace(
                  /\{\{\s*([\w.]+)\s*\}\}/g,
                  (match, name) => values[name] || match,
                )}
              </pre>
            ) : (
              <textarea
                className="prompt-code"
                aria-label="Prompt content"
                value={p.content}
                onChange={(e) => patch({ content: e.target.value })}
                spellCheck={false}
              />
            )}
            <div className="variables">
              <div className="eyebrow">
                PREVIEW INPUTS <span>{variables.length} variables</span>
              </div>
              {variables.length ? (
                <div className="form-grid">
                  {variables.map((v) => {
                    const name = v.replace(/[{}\s]/g, "");
                    return (
                      <label key={name}>
                        <code>{name}</code>
                        <input
                          value={values[name] || ""}
                          placeholder={`Enter ${name}`}
                          onChange={(e) =>
                            setValues({ ...values, [name]: e.target.value })
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="field-help">
                  No template variables. This prompt is static content.
                </p>
              )}
            </div>
          </section>
        ) : (
          <div className="empty-state">
            <FileText />
            <h3>No prompts yet</h3>
            <p>Add a prompt to define this agent’s behavior.</p>
          </div>
        )}
      </div>
    </>
  );
}
function LayersIcon() {
  return <Settings2 size={14} />;
}
function Models({
  agent,
  data,
  onChange,
  onAssign,
}: {
  agent: Agent;
  data: StudioData;
  onChange: (m: ModelProfile[]) => void;
  onAssign: (ids: string[]) => void;
}) {
  const assigned = data.models.filter((m) => agent.modelIds.includes(m.id));
  const [id, setId] = useState(assigned[0]?.id || "");
  const m = assigned.find((m) => m.id === id) || assigned[0];
  const patch = (changes: Partial<ModelProfile>) => {
    const next = editAssignedModel(
      data,
      agent.id,
      m.id,
      changes,
      crypto.randomUUID(),
    );
    onChange(next.models);
    onAssign(next.modelIds);
    setId(next.selectedId);
  };
  const fields: {
    key: keyof ModelProfile;
    label: string;
    type?: string;
    min?: number;
    max?: number;
    step?: string;
  }[] = [
    { key: "provider", label: "Provider" },
    { key: "model", label: "Model name" },
    { key: "version", label: "Model version" },
    { key: "deployment", label: "Deployment name" },
    { key: "endpoint", label: "API endpoint" },
    { key: "apiVersion", label: "API version" },
    { key: "client", label: "API / client configuration" },
    { key: "credentialRef", label: "Credential reference" },
    {
      key: "timeout",
      label: "Request timeout (seconds)",
      type: "number",
      min: 1,
    },
    { key: "retries", label: "Retry attempts", type: "number", min: 0 },
  ];
  return (
    <>
      <div className="section-title">
        <div>
          <h3>Model configuration</h3>
          <p>
            Inspect providers, deployments, client settings, and generation
            behavior.
          </p>
        </div>
      </div>
      <div className="model-cards">
        {assigned.map((x) => (
          <div
            className={`model-choice ${m?.id === x.id ? "selected" : ""}`}
            key={x.id}
          >
            <button
              className="model-selection"
              aria-label={`${x.kind} ${x.name} ${x.provider} ${x.deployment}`}
              aria-pressed={m?.id === x.id}
              onClick={() => setId(x.id)}
            />
            <span className="model-icon">
              {x.kind === "Embedding" ? (
                <Network size={21} />
              ) : (
                <Sparkles size={21} />
              )}
            </span>
            <div className="model-card-details">
              <span className="eyebrow">{x.kind}</span>
              <div className="model-name-row">
                <strong>{x.name}</strong>
                <ModelSharingInfo
                  name={x.name}
                  agents={data.agents
                    .filter(
                      (a) =>
                        a.role !== "coordinator" && a.modelIds.includes(x.id),
                    )
                    .map((a) => a.name)}
                />
              </div>
              <small>
                {x.provider} / {x.deployment}
              </small>
            </div>
            <span className="radio-dot" />
          </div>
        ))}
      </div>
      {m ? (
        <>
          <section className="panel model-panel">
            <div className="panel-title">
              <Settings2 size={17} />
              <h4>Provider & connection</h4>
              <button
                className="text-danger"
                onClick={() => {
                  onAssign(agent.modelIds.filter((x) => x !== m.id));
                  setId("");
                }}
              >
                Unassign profile
              </button>
            </div>
            <div className="form-grid">
              <label className="span-2">
                Profile name
                <input
                  value={m.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>
              {fields.map((f) => (
                <label key={f.key}>
                  {f.label}
                  <input
                    type={f.type || "text"}
                    min={f.min}
                    value={m[f.key]}
                    onChange={(e) =>
                      patch({
                        [f.key]:
                          f.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="field-help">
              Credential references are labels such as AZURE_OPENAI_API_KEY.
              Actual credentials are not entered here.
            </p>
          </section>
          <section className="panel model-panel">
            <div className="panel-title">
              <Settings2 size={17} />
              <h4>
                {m.kind === "Embedding"
                  ? "Embedding settings"
                  : "Generation settings"}
              </h4>
            </div>
            <div className="form-grid">
              {(m.kind === "Embedding"
                ? [
                    { key: "dimensions", label: "Vector dimensions", min: 1 },
                    { key: "batchSize", label: "Batch size", min: 1 },
                  ]
                : [
                    {
                      key: "temperature",
                      label: "Temperature",
                      min: 0,
                      max: 2,
                      step: "0.1",
                    },
                    {
                      key: "topP",
                      label: "Top P",
                      min: 0,
                      max: 1,
                      step: "0.05",
                    },
                    {
                      key: "maxTokens",
                      label: "Maximum output tokens",
                      min: 1,
                    },
                  ]
              ).map((f) => (
                <label key={f.key}>
                  {f.label}
                  <input
                    type="number"
                    min={f.min}
                    max={"max" in f ? f.max : undefined}
                    step={"step" in f ? f.step : 1}
                    value={m[f.key as keyof ModelProfile]}
                    onChange={(e) => patch({ [f.key]: Number(e.target.value) })}
                  />
                </label>
              ))}
              {m.kind === "Language model" && (
                <label>
                  Reasoning effort
                  <select
                    value={m.reasoning}
                    onChange={(e) => patch({ reasoning: e.target.value })}
                  >
                    {["none", "low", "medium", "high", "xhigh"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <p className="field-help">
              Availability of individual settings depends on the chosen provider
              and model.
            </p>
          </section>
        </>
      ) : (
        <div className="empty-state">
          <Boxes />
          <h3>No model assigned</h3>
          <p>No model configuration is assigned to this agent.</p>
        </div>
      )}
    </>
  );
}
