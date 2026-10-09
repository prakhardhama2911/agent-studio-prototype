import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Bot,
  Boxes,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Database,
  FileText,
  FolderOpen,
  Layers3,
  Link2,
  Loader2,
  Network,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Unplug,
  X,
} from "lucide-react";
import type { Agent, StudioData, Group } from "./types";
import { freshSeed, hydrateSampleSkills } from "./data";
import {
  exportDocument,
  identityScope,
  loadDraft,
  parseDocument,
  saveDraft,
} from "./lib/core.mjs";
import { readApi } from "./lib/api";
import { Workspace } from "./workspace";
import { Badge, Button, Dialog } from "./ui";
import "./styles.css";
function download(data: StudioData) {
  const url = URL.createObjectURL(
    new Blob([exportDocument(data)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "alchemy-agent-studio.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
declare const __BACKEND_ID__: string;
const sampleKey = "alchemy-studio:v1:sample";
function App() {
  const [data, setData] = useState<StudioData>(freshSeed);
  const [base, setBase] = useState<StudioData>(freshSeed);
  const [storageKey, setStorageKey] = useState(sampleKey);
  const [mode, setMode] = useState<"sample" | "live">("sample");
  const [token, setToken] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);
  const [newItem, setNewItem] = useState<"group" | string | null>(null);
  const [manage, setManage] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const draft = loadDraft(localStorage, sampleKey);
      if (draft) setData(hydrateSampleSkills(draft));
    } catch {
      setError(
        "Saved browser data could not be loaded. You can use the example catalog and export your work.",
      );
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  const commit = (next: StudioData) => {
    saveDraft(localStorage, storageKey, next);
    setData(next);
    setNotice("Changes saved");
  };
  const safeCommit = (next: StudioData) => {
    try {
      commit(next);
    } catch {
      setError(
        "Browser storage is unavailable or full. Export your changes before leaving.",
      );
      setData(next);
    }
  };
  const useSamples = () => {
    setMode("sample");
    setToken("");
    setSelected(null);
    setStorageKey(sampleKey);
    const seed = freshSeed();
    setBase(seed);
    try {
      setData(hydrateSampleSkills(loadDraft(localStorage, sampleKey) || seed));
    } catch {
      setData(seed);
    }
    setError("");
    setConnect(false);
  };
  const loadLive = async (accessToken: string) => {
    setBusy(true);
    setError("");
    setSelected(null);
    setData({ agents: [], groups: [], workers: [], models: [] });
    try {
      const identity = identityScope(accessToken);
      const result = await readApi("/api/bootstrap", accessToken);
      if (!Array.isArray(result.agents))
        throw Error("Backend did not return an agent catalog.");
      const next = freshSeed();
      next.groups = [];
      next.agents = next.agents.filter((a) => a.role === "planner");
      for (const s of result.agents) {
        if (s.agentRole === "coordinator") {
          const co = freshSeed().agents[0];
          next.agents.unshift({
            ...co,
            id: s.id,
            backendId: s.id,
            skillId: "primary",
            name: s.name,
            description: s.description || co.description,
            origin: "Live",
            files: {},
            scope: (s.keywords || []).join(" · ") || co.scope,
          });
          continue;
        }
        next.groups.push({
          id: s.id,
          name: s.name,
          description: s.description || "",
          color: s.color || "#6772ff",
        });
        const definitions = [...(s.subskillDefinitions || [])];
        if (!s.presentationOnlyGroup && s.skill)
          definitions.unshift({
            id: "primary",
            name: s.name,
            description: s.description,
          });
        for (const def of definitions) {
          const match = freshSeed().agents.find((a) => a.skillId === def.id);
          const id = `${s.id}/${def.id}`;
          next.agents.push({
            ...match,
            id,
            backendId: s.id,
            skillId: def.id,
            name: def.name,
            role: "worker",
            groupId: s.id,
            description: def.description || "",
            scope:
              [
                ...(def.metrics || s.metrics || []),
                ...(def.dimensions || s.dimensions || []),
              ].join(" · ") || "Question-driven scope",
            instructions:
              def.description ||
              "Open Skills to inspect the saved instructions.",
            files: {},
            skillOrigin: "Live",
            prompts: match?.prompts || [],
            modelIds: ["language-shared"],
            origin: "Live",
          });
        }
      }
      next.workers = next.workers.flatMap((w) => {
        const a = next.agents.find((a) => a.skillId === w.agentId);
        return a ? [{ ...w, agentId: a.id }] : [];
      });
      const key = `alchemy-studio:v1:live:${__BACKEND_ID__}:${identity}`;
      setBase(next);
      setStorageKey(key);
      let draft = null;
      try {
        draft = loadDraft(localStorage, key);
      } catch {
        setError(
          "This connection’s saved draft could not be restored. Live data has been loaded.",
        );
      }
      setData(draft || next);
      setMode("live");
      setToken(accessToken);
      setConnect(false);
      setNotice("Connected · read-only backend access");
    } catch (e) {
      setToken("");
      setError((e as Error).message);
      setConnect(true);
    } finally {
      setBusy(false);
    }
  };
  const openAgent = async (a: Agent) => {
    if (a.role === "coordinator") return;
    setError("");
    if (
      mode === "live" &&
      a.backendId &&
      a.skillId &&
      !Object.keys(a.files).length
    ) {
      setBusy(true);
      try {
        const p = await readApi(
          `/api/agent-studio/skill-packages/${encodeURIComponent(a.backendId)}/${encodeURIComponent(a.skillId)}`,
          token,
        );
        if (!Array.isArray(p.files))
          throw Error("The package did not contain a file list.");
        const files = Object.fromEntries(
          p.files.map((f: any) => [f.relativePath, f.content]),
        );
        setData((d) => ({
          ...d,
          agents: d.agents.map((x) => (x.id === a.id ? { ...x, files } : x)),
        }));
        setBase((d) => ({
          ...d,
          agents: d.agents.map((x) => (x.id === a.id ? { ...x, files } : x)),
        }));
        setSelected(a.id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    } else setSelected(a.id);
  };
  const reset = () => {
    if (!confirm("Reset changes to the loaded catalog?")) return;
    try {
      localStorage.removeItem(storageKey);
      setData(structuredClone(base));
      setNotice("Changes reset");
    } catch {
      setError("Browser storage could not be reset.");
    }
  };
  const visible = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase());
  const agents = data.agents;
  const selectedAgent = agents.find((a) => a.id === selected);
  const activeGroup = data.groups.find((g) => g.id === groupId);
  return (
    <>
      <nav className="topbar">
        <div className="brand">
          <span className="brand-mark">◭</span>
          <div>
            BBAi
            <small>
              POWERED BY <b>BCN</b>
            </small>
          </div>
        </div>
        <div className="nav-links">
          {[
            "Home",
            "Brand Plan Assessment",
            "Chatbot",
            "Agent Studio",
            "Settings",
            "About",
          ].map((n) => (
            <button
              key={n}
              className={n === "Agent Studio" ? "active" : ""}
              onClick={() => n !== "Agent Studio" && setHelp(true)}
            >
              {n}
              {n !== "About" && <ChevronDown size={11} />}
            </button>
          ))}
        </div>
        <button
          className="icon-btn light"
          aria-label="About Agent Studio"
          onClick={() => setHelp(true)}
        >
          <Sun size={19} />
        </button>
        <div className="avatar">PD</div>
      </nav>
      <main className="shell">
        <header className="hero">
          <div>
            <div className="eyebrow">
              <span className="red-line" /> CONFIGURATION LAYER
            </div>
            <h1>Agent Studio</h1>
            <p>
              Bring every agent’s skills, instructions, and intelligence
              together.
              <br />
              Explore your orchestration system. Shape what happens next.
            </p>
          </div>
          <div className="hero-aside">
            <div className="stats">
              <div>
                <span>RUNNABLE ANALYSES</span>
                <strong>
                  {agents.filter((a) => a.role === "worker").length}
                  <small>across {data.groups.length} groups</small>
                </strong>
              </div>
              <div>
                <span>WORKSPACE</span>
                <strong className="workspace-stat">
                  <span className="status-dot green" />
                  {mode === "sample" ? "Ready" : "Live catalog"}
                </strong>
              </div>
            </div>
            <Button primary onClick={() => setNewItem("group")}>
              <Plus size={17} />
              Create group
            </Button>
          </div>
        </header>
        <section className="catalog">
          {activeGroup ? (
            <GroupDetail
              key={activeGroup.id}
              group={activeGroup}
              agents={agents.filter(
                (a) => a.role === "worker" && a.groupId === activeGroup.id,
              )}
              onBack={() => {
                const previous = activeGroup.id;
                setGroupId(null);
                requestAnimationFrame(() =>
                  document.getElementById("group-card-" + previous)?.focus(),
                );
              }}
              onOpen={openAgent}
              onManage={() => setManage(activeGroup.id)}
              onAdd={() => setNewItem(activeGroup.id)}
            />
          ) : (
            <>
              <div className="catalog-heading">
                <div>
                  <div className="eyebrow">ACTIVE ANALYSIS CATALOG</div>
                  <h2>Coordinator and analysis groups</h2>
                </div>
                <p>
                  Configure the agents behind your analyses.
                  <br />
                  Open a card to explore its complete configuration.
                </p>
              </div>
              <div className="toolbar">
                <div className="search">
                  <Search size={20} />
                  <input
                    aria-label="Search agents and groups"
                    placeholder="Find an agent or group…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              {error && (
                <div className="alert" role="alert">
                  {error}
                  <button
                    onClick={() => setError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {busy && (
                <div className="loading">
                  <Loader2 size={18} className="spin" /> Reading backend
                  configuration…
                </div>
              )}
              <div className="card-grid">
                {agents
                  .filter(
                    (a) =>
                      a.role !== "worker" &&
                      visible(a.name + " " + a.description),
                  )
                  .map((a) =>
                    a.role === "coordinator" ? (
                      <article
                        key={a.id}
                        className="agent-card system-card coordinator display-only"
                        aria-label="Coordinator group"
                      >
                        <div className="card-top">
                          <span className="card-index">01</span>
                          <Badge tone="green">UI group</Badge>
                        </div>
                        <div className="agent-symbol">
                          <Network size={24} />
                        </div>
                        <h3>{a.name}</h3>
                        <p>
                          Orchestrates analysis execution, delegates approved
                          tasks to specialist agents, and brings their results
                          together.
                        </p>
                      </article>
                    ) : (
                      <button
                        key={a.id}
                        className={`agent-card system-card ${a.role}`}
                        onClick={() => openAgent(a)}
                      >
                        <div className="card-top">
                          <span className="card-index">{"02"}</span>
                          <Badge tone="purple">{a.role}</Badge>
                        </div>
                        <div className="agent-symbol">
                          <BrainCircuit size={24} />
                        </div>
                        <h3>
                          {a.name}
                          <ArrowUpRight size={17} />
                        </h3>
                        <p>{a.description}</p>
                        <div className="config-counts">
                          <span>
                            <FolderOpen size={13} />
                            {Object.keys(a.files).length || "—"} files
                          </span>
                          <span>
                            <FileText size={13} />
                            {a.prompts.length} prompts
                          </span>
                          <span>
                            <Boxes size={13} />
                            {a.modelIds.length} models
                          </span>
                        </div>
                        <div className="card-footer">
                          <span>Planning & worker discovery</span>
                          <ChevronRight size={16} />
                        </div>
                      </button>
                    ),
                  )}
                {data.groups
                  .filter((g) =>
                    visible(
                      g.name +
                        " " +
                        g.description +
                        " " +
                        agents
                          .filter((a) => a.groupId === g.id)
                          .map((a) => a.name)
                          .join(" "),
                    ),
                  )
                  .map((g, index) => {
                    const count = agents.filter(
                      (a) => a.role === "worker" && a.groupId === g.id,
                    ).length;
                    return (
                      <button
                        key={g.id}
                        id={`group-card-${g.id}`}
                        className="agent-card system-card group-entry"
                        style={{ "--accent": g.color } as React.CSSProperties}
                        onClick={() => setGroupId(g.id)}
                        aria-label={`Open ${g.name}, ${count} sub-agents`}
                      >
                        <div className="card-top">
                          <span className="card-index">
                            {String(index + 3).padStart(2, "0")}
                          </span>
                          <Badge>UI group</Badge>
                        </div>
                        <div className="agent-symbol">
                          <Layers3 size={24} />
                        </div>
                        <h3>
                          {g.name}
                          <ChevronRight size={17} />
                        </h3>
                        <p>{g.description}</p>
                        <div className="card-footer">
                          <span>
                            {count} sub-agent{count === 1 ? "" : "s"}
                          </span>
                          <span>
                            View group <ChevronRight size={14} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
              {!agents.some(
                (a) =>
                  a.role !== "worker" && visible(a.name + " " + a.description),
              ) &&
                !data.groups.some((g) =>
                  visible(
                    g.name +
                      " " +
                      g.description +
                      " " +
                      agents
                        .filter((a) => a.groupId === g.id)
                        .map((a) => a.name)
                        .join(" "),
                  ),
                ) && (
                  <div className="empty-state">
                    <Search />
                    <h3>No matching agents</h3>
                    <p>Try another name or clear your search.</p>
                  </div>
                )}
            </>
          )}
          <div className="catalog-foot">
            <span>Alchemy / Agent Studio</span>
          </div>
        </section>
      </main>
      <input
        ref={input}
        hidden
        type="file"
        accept=".json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            try {
              const next = parseDocument(await f.text());
              if (
                confirm(
                  "Replace this browser’s draft catalog with the imported configuration?",
                )
              )
                safeCommit(next);
            } catch (err) {
              setError((err as Error).message);
            }
          }
          e.target.value = "";
        }}
      />
      {selectedAgent && (
        <Workspace
          key={selectedAgent.id}
          data={data}
          agentId={selectedAgent.id}
          source={base}
          onClose={() => setSelected(null)}
          onSave={commit}
        />
      )}
      {connect && (
        <Connection
          busy={busy}
          error={error}
          initialToken={token}
          onClose={() => setConnect(false)}
          onConnect={loadLive}
          onSamples={useSamples}
        />
      )}
      {newItem && (
        <CreateItem
          group={
            newItem === "group"
              ? null
              : data.groups.find((g) => g.id === newItem)!
          }
          onClose={() => setNewItem(null)}
          onCreate={(name, description) => {
            const id = crypto.randomUUID();
            if (newItem === "group") {
              safeCommit({
                ...data,
                groups: [
                  ...data.groups,
                  { id, name, description, color: "#6772ff" },
                ],
              });
            } else {
              const a: Agent = {
                id,
                name,
                description,
                groupId: newItem,
                role: "worker",
                scope: "Question-driven",
                instructions: description,
                files: { "SKILL.md": `# ${name}\n\n${description}` },
                prompts: [
                  {
                    id: crypto.randomUUID(),
                    name: "System instructions",
                    purpose: "Define this worker’s behavior.",
                    content: `You are ${name}.\n\nTask: {{question}}\nScope: {{scope}}`,
                  },
                ],
                modelIds: data.models
                  .filter((m) => m.kind === "Language model")
                  .slice(0, 1)
                  .map((m) => m.id),
                origin: "Local draft",
              };
              safeCommit({ ...data, agents: [...data.agents, a] });
              setSelected(id);
            }
            setNewItem(null);
          }}
        />
      )}
      {manage && (
        <ManageGroup
          group={data.groups.find((g) => g.id === manage)!}
          onClose={() => setManage(null)}
          onSave={(name, description) => {
            safeCommit({
              ...data,
              groups: data.groups.map((g) =>
                g.id === manage ? { ...g, name, description } : g,
              ),
            });
            setManage(null);
          }}
        />
      )}
      {help && (
        <Dialog
          title="Explore Agent Studio"
          eyebrow="AGENT STUDIO / GUIDE"
          onClose={() => setHelp(false)}
        >
          <div className="dialog-body guide">
            <div className="guide-icon">
              <Sparkles size={28} />
            </div>
            <p>One place to inspect and shape every agent’s configuration.</p>
            <ol>
              <li>
                <strong>Start with the catalog.</strong> Open the Planner or a
                sub-agent to explore its configuration.
              </li>
              <li>
                <strong>Meet the Planner.</strong> Inspect its repository
                prompt, skills, worker catalog, and embedding model.
              </li>
              <li>
                <strong>Open PQA Analysis.</strong> Edit a skill or prompt,
                preview it, and save your changes.
              </li>
              <li>
                <strong>Inspect Models.</strong> Configure providers,
                deployments, and generation settings for each agent.
              </li>
              <li>
                <strong>Take your work with you.</strong> Export a configuration
                snapshot, or connect to read existing database skills.
              </li>
            </ol>
          </div>
          <footer className="dialog-footer">
            <Button primary onClick={() => setHelp(false)}>
              Explore Agent Studio
              <ArrowUpRight size={15} />
            </Button>
          </footer>
        </Dialog>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
    </>
  );
}
function GroupDetail({
  group,
  agents,
  onBack,
  onOpen,
  onManage,
  onAdd,
}: {
  group: Group;
  agents: Agent[];
  onBack: () => void;
  onOpen: (agent: Agent) => void;
  onManage: () => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const visible = agents.filter((a) =>
    (a.name + " " + a.description).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="group-detail">
      <button className="button back-to-groups" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to groups
      </button>
      <div className="group-detail-heading">
        <div>
          <div className="eyebrow">ANALYSIS GROUP</div>
          <h2 ref={heading} tabIndex={-1}>
            {group.name}
          </h2>
          <p>{group.description}</p>
          <span className="group-count">
            {agents.length} sub-agent{agents.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="group-detail-actions">
          <Button onClick={onManage}>Manage group</Button>
          <Button primary onClick={onAdd}>
            <Plus size={16} />
            Add sub-agent
          </Button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={20} />
          <input
            aria-label="Search sub-agents"
            placeholder="Find a sub-agent..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="card-grid">
        {visible.map((agent, index) => (
          <button
            className="agent-card system-card subagent-card"
            key={agent.id}
            style={{ "--accent": group.color } as React.CSSProperties}
            onClick={() => onOpen(agent)}
          >
            <div className="card-top">
              <span className="card-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Badge tone="green">Planner selectable</Badge>
            </div>
            <div className="agent-symbol">
              <Bot size={24} />
            </div>
            <h3>
              {agent.name}
              <ArrowUpRight size={17} />
            </h3>
            <p>{agent.description}</p>
            <div className="config-counts">
              <span>
                <FolderOpen size={13} />
                {Object.keys(agent.files).length} files
              </span>
              <span>
                <FileText size={13} />
                {agent.prompts.length} prompts
              </span>
            </div>
            <div className="card-footer">
              <span>Open configuration</span>
              <ChevronRight size={16} />
            </div>
          </button>
        ))}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <Layers3 size={28} />
          <h3>
            {agents.length ? "No matching sub-agents" : "No sub-agents yet"}
          </h3>
          <p>
            {agents.length
              ? "Try another name or clear your search."
              : "Add the first sub-agent to this group."}
          </p>
          {agents.length ? (
            <Button onClick={() => setQuery("")}>Clear search</Button>
          ) : (
            <Button primary onClick={onAdd}>
              Add sub-agent
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
function Connection({
  busy,
  error,
  initialToken,
  onClose,
  onConnect,
  onSamples,
}: {
  busy: boolean;
  error: string;
  initialToken: string;
  onClose: () => void;
  onConnect: (t: string) => void;
  onSamples: () => void;
}) {
  const [t, setT] = useState(initialToken);
  return (
    <Dialog
      title="Connect your live skills"
      eyebrow="READ-ONLY CONNECTION"
      onClose={onClose}
    >
      <div className="dialog-body">
        <div className="info-box">
          <Database size={18} />
          <span>
            Load the agent catalog and saved skill packages from your backend.
          </span>
        </div>
        <label>
          Backend connection
          <input disabled value="Development proxy → AGENT_BACKEND_URL" />
        </label>

        <label>
          Access token{" "}
          <span className="optional">
            optional when authentication is not required
          </span>
          <textarea
            rows={4}
            value={t}
            onChange={(e) => setT(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste an authorized JWT access token"
          />
        </label>
        <p className="field-help">
          Held in memory only. Never included in saved drafts or exports.
        </p>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer className="dialog-footer">
        <Button onClick={onSamples} disabled={busy}>
          <Unplug size={15} />
          Use workspace catalog
        </Button>
        <Button primary disabled={busy} onClick={() => onConnect(t.trim())}>
          {busy ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />}
          Connect
        </Button>
      </footer>
    </Dialog>
  );
}
function CreateItem({
  group,
  onClose,
  onCreate,
}: {
  group: Group | null;
  onClose: () => void;
  onCreate: (n: string, d: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog
      title={group ? "Add sub-agent" : "Create analysis group"}
      eyebrow={group ? group.name : "ANALYSIS CATALOG"}
      onClose={onClose}
    >
      <div className="dialog-body">
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              group
                ? "e.g. Pricing Opportunity Analysis"
                : "e.g. Revenue Growth"
            }
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this help your team do?"
          />
        </label>
      </div>
      <footer className="dialog-footer">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          primary
          disabled={!name.trim() || !description.trim()}
          onClick={() => onCreate(name.trim(), description.trim())}
        >
          <Plus size={15} />
          {group ? "Create sub-agent" : "Create group"}
        </Button>
      </footer>
    </Dialog>
  );
}
function ManageGroup({
  group,
  onClose,
  onSave,
}: {
  group: Group;
  onClose: () => void;
  onSave: (n: string, d: string) => void;
}) {
  const [name, setName] = useState(group.name),
    [description, setDescription] = useState(group.description);
  return (
    <Dialog title="Manage group" eyebrow="PRESENTATION GROUP" onClose={onClose}>
      <div className="dialog-body">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="info-box">
          Groups organize sub-agents. Skills, prompts, and model settings belong
          to the executable agents inside them.
        </div>
      </div>
      <footer className="dialog-footer">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          primary
          disabled={!name.trim()}
          onClick={() => onSave(name.trim(), description.trim())}
        >
          Save changes
        </Button>
      </footer>
    </Dialog>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
