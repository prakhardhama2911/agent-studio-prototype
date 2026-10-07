import { ReviewDiff } from "./ReviewDiff";
import React, { useEffect, useRef, useState } from "react";
import {
  Network,
  GitBranch,
  GitCompareArrows,
  History,
  Upload,
  Save,
  Check,
  ArrowRight,
  FolderOpen,
  FileText,
  Boxes,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { AgentDraftTour, AGENT_TOUR_ENABLED } from "./AgentDraftTour";
import { Dialog, Button, Badge } from "./ui";
import { SkillPackageEditor } from "./SkillPackageEditor";
import {
  WorkerRegistryViewer,
  defaultWorkerFiles,
} from "./WorkerRegistryViewer";
import { PromptEditor, Models } from "./workspace";
import { EditModeContext } from "./EditModeContext";
import type { Agent, StudioData } from "./types";
import {
  initialWorkflow,
  packageFrom,
  createDraft,
  changes,
  mergePlan,
  packageFromArtefacts,
  copy,
} from "./agentWorkflow";
import type { AgentPackage, WorkflowState } from "./agentWorkflow";

import {
  createAgentWorkflowService,
  agentCapabilities,
  DEMO_USERS,
} from "./agentWorkflowService";
import type { AgentWorkflowService } from "./agentWorkflowService";

type View = "development" | "draft" | "publications";
const owners = DEMO_USERS;
const tabs = [
  { name: "Skills", icon: FolderOpen },
  { name: "Prompts", icon: FileText },
  { name: "Worker Definitions", icon: Network },
  { name: "Models", icon: Boxes },
];
export function AgentWorkspace({
  data,
  agent,
  onClose,
  catalogId,
  onActiveChange,
  service: suppliedService,
}: {
  data: StudioData;
  agent: Agent;
  onClose: () => void;
  catalogId: string;
  onActiveChange?: (agentId: string, content: AgentPackage) => void;
  service?: AgentWorkflowService;
}) {
  const initial = useRef(
    initialWorkflow(
      packageFrom(data, agent, defaultWorkerFiles),
      agent.id,
      agent.role === "planner" ? "planner" : "worker",
    ),
  );
  const [service] = useState(
    () =>
      suppliedService ??
      createAgentWorkflowService({
        catalogId,
        agent,
        data,
        workerFiles: defaultWorkerFiles,
      }),
  );
  const capabilities = agentCapabilities(agent.role);
  const visibleTabs = tabs.filter(
    (t) => t.name !== "Worker Definitions" || capabilities.workerDefinitions,
  );
  const [store, setStore] = useState<WorkflowState>(initial.current);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const activeCallback = useRef(onActiveChange);
  activeCallback.current = onActiveChange;
  const accept = (next: WorkflowState) => {
    if (mounted.current) {
      setStore(next);
      activeCallback.current?.(agent.id, next.development.content);
    }
    return next;
  };
  const load = async () => {
    try {
      accept(await service.load());
      if (mounted.current) {
        setLoaded(true);
        setError("");
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void load();
    const unsubscribe = service.subscribe(() => {
      if (!busyRef.current) void load();
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [service]);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStore, setTourStore] = useState<WorkflowState | null>(null);
  const tourReturn = useRef<{
    view: View;
    tab: string;
    working: AgentPackage | null;
    draftId: string;
    revision: number;
    status: string;
    error: string;
    scroll: number;
  } | null>(null);
  const [tourDismissed, setTourDismissed] = useState(true);
  const dismissTour = () => {
    const previous = tourReturn.current;
    if (previous) {
      setView(previous.view);
      setTab(previous.tab);
      setWorking(previous.working);
      setDraftId(previous.draftId);
      setRevision(previous.revision);
      setStatus(previous.status);
      setError(previous.error);
      requestAnimationFrame(() => {
        const panel = document.querySelector(".planner-content");
        if (panel) panel.scrollTop = previous.scroll;
      });
      tourReturn.current = null;
    }
    setTourStore(null);
    setTourOpen(false);
    setTourDismissed(true);
    void service.markTourSeen(owner).catch(() => {});
  };
  const beginTour = () => {
    tourReturn.current = {
      view,
      tab,
      working: working ? copy(working) : null,
      draftId,
      revision,
      status,
      error,
      scroll: document.querySelector(".planner-content")?.scrollTop ?? 0,
    };
    setTourStore(copy(store));
    if (view === "publications") setView("development");
    setTab("Skills");
    setTourOpen(true);
  };
  const [owner, setOwner] = useState(DEMO_USERS[0].id);
  const ownerName = DEMO_USERS.find((u) => u.id === owner)?.name ?? owner;
  useEffect(() => {
    let active = true;
    service
      .tourSeen(owner)
      .then((seen) => {
        if (active) setTourDismissed(seen);
      })
      .catch(() => {
        if (active) setTourDismissed(false);
      });
    return () => {
      active = false;
    };
  }, [service, owner]);
  const [view, setView] = useState<View>("development");
  const [tab, setTab] = useState("Skills");
  const [working, setWorking] = useState<AgentPackage | null>(null);
  const [draftId, setDraftId] = useState("");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("");
  const [review, setReview] = useState<{
    before: AgentPackage;
    after: AgentPackage;
    label: string;
    draftId?: string;
  } | null>(null);
  const [modal, setModal] = useState<
    "publish" | "discard" | "exit" | "close" | "advance" | "reset" | null
  >(null);
  const [summary, setSummary] = useState("");
  const [rebasing, setRebasing] = useState<{
    plan: ReturnType<typeof mergePlan>;
    targetId: string;
    targetVersion: number;
    target: AgentPackage;
  } | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [resolutionText, setResolutionText] = useState<Record<string, string>>(
    {},
  );
  const mine = (tourStore ?? store).drafts[owner];
  const isDraft = view === "draft" && !!mine && !!working;
  const content = isDraft ? working! : store.development.content;
  const dirty =
    isDraft && JSON.stringify(working) !== JSON.stringify(mine?.content);
  const stale = !!mine && mine.baselineId !== store.development.publicationId;
  const changeList = isDraft ? changes(mine.baseline, working!) : [];
  const commit = async (request: Promise<WorkflowState>) => {
    const next = accept(await request);
    setError("");
    return next;
  };
  const attempt = async (action: () => void | Promise<unknown>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e) {
      setError((e as Error).message);
      setStatus("Action failed - changes retained");
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const draftRef = () => ({ owner, id: draftId, revision });
  const openDraft = (next: WorkflowState) => {
    const d = next.drafts[owner];
    setWorking(copy(d.content));
    setDraftId(d.id);
    setRevision(d.revision);
    setView("draft");
    setStatus("Draft saved");
    setTab("Skills");
  };
  const saveNow = async () => {
    if (!working) throw Error("No draft is open.");
    setStatus("Saving draft...");
    const next = await commit(service.saveDraft(draftRef(), working));
    setRevision(next.drafts[owner].revision);
    setStatus("Draft saved");
    return next;
  };
  useEffect(() => {
    if (!dirty || rebasing || tourOpen || busy || error) return;
    setStatus("Saving draft...");
    const timer = setTimeout(() => {
      void attempt(() => saveNow());
    }, 700);
    return () => clearTimeout(timer);
  }, [working, view, owner, revision, rebasing, tourOpen, busy, error]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const leave = (close = false) => {
    if (dirty) {
      setModal(close ? "close" : "exit");
      return;
    }
    setView("development");
    setWorking(null);
    if (close) onClose();
  };
  const patch = (changes: Partial<AgentPackage>) => {
    if (isDraft && !busyRef.current) {
      setError("");
      setWorking((p) => ({ ...p!, ...changes }));
    }
  };
  const currentAgent: Agent = { ...agent, ...content };
  const editorData: StudioData = {
    ...data,
    agents: [currentAgent],
    models: content.models,
  };
  const beginUpdate = () =>
    attempt(async () => {
      const next = await saveNow(),
        d = next.drafts[owner],
        target = next.development;
      setRebasing({
        plan: mergePlan(d.baseline, d.content, target.content),
        targetId: target.publicationId,
        targetVersion: target.version,
        target: copy(target.content),
      });
      setResolutions({});
      setResolutionText({});
    });
  const finishUpdate = () =>
    attempt(async () => {
      if (!rebasing) return;
      const entries = { ...rebasing.plan.merged };
      for (const path of rebasing.plan.conflicts) {
        const choice = resolutions[path];
        if (!choice)
          throw Error("Resolve every conflict before updating the baseline.");
        const value =
          choice === "mine"
            ? rebasing.plan.mine[path]
            : choice === "latest"
              ? rebasing.plan.latest[path]
              : resolutionText[path];
        if (value === undefined) delete entries[path];
        else entries[path] = value;
      }
      const merged = packageFromArtefacts(entries);
      const next = await commit(
        service.updateDraft(draftRef(), rebasing.targetId, merged),
      );
      openDraft(next);
      setRebasing(null);
      setStatus("Draft updated against latest development");
    });
  const count = (name: string) =>
    name === "Skills"
      ? Object.keys(content.files).length
      : name === "Prompts"
        ? content.prompts.length
        : name === "Worker Definitions"
          ? Object.keys(content.workerFiles ?? {}).length
          : content.modelIds.length;
  const reviewed = isDraft && !dirty && mine.reviewedRevision === mine.revision;
  const step = modal === "publish" ? 3 : review || reviewed ? 2 : 1;
  const closeReview = async () => {
    if (review?.draftId === draftId && isDraft && !tourOpen) {
      if (JSON.stringify(review.after) !== JSON.stringify(working)) {
        setError(
          "The draft changed while the comparison was open. Return to your draft and review the latest changes.",
        );
        return;
      }
      const ok = await attempt(async () => {
        const next = await commit(service.reviewDraft(draftRef(), working!));
        setRevision(next.drafts[owner].revision);
        setStatus("Draft saved");
      });
      if (!ok) return;
    }
    setReview(null);
  };
  if (!loaded)
    return (
      <Dialog
        eyebrow="AGENT CONFIGURATION"
        title={agent.name}
        onClose={onClose}
      >
        <div className="dialog-body">
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Button onClick={() => void load()}>Retry loading</Button>
            </>
          ) : (
            <p role="status">Loading agent configuration...</p>
          )}
        </div>
      </Dialog>
    );
  return (
    <Dialog
      className="planner-dialog"
      title={agent.name}
      eyebrow={`AGENT STUDIO / ${agent.role === "planner" ? "PLANNER" : "SUB-AGENT"} CONFIGURATION`}
      onClose={() => {
        if (!busyRef.current) leave(true);
      }}
      wide
    >
      <fieldset
        className="workflow-interactions"
        disabled={busy}
        aria-busy={busy}
      >
        <div className="workspace-summary planner-summary">
          <div className={`workspace-symbol ${agent.role}`}>
            <Network size={24} />
          </div>
          <div className="planner-summary-copy">
            <div className="summary-badges">
              <Badge tone="green">
                {agent.role === "planner" ? "Planner" : "Planner selectable"}
              </Badge>
              {agent.groupId && (
                <Badge>
                  {data.groups.find((g) => g.id === agent.groupId)?.name ??
                    "Analysis group"}
                </Badge>
              )}
              <Badge tone={isDraft ? "amber" : "neutral"}>
                {isDraft ? "Your draft" : "Active development"} ·{" "}
                {isDraft
                  ? "baseline v" + mine.baselineVersion
                  : "v" + store.development.version}
              </Badge>
            </div>
            <p>{agent.description}</p>
          </div>
          <div className="workspace-publish" data-planner-tour="draft-action">
            {isDraft ? (
              <>
                <Button
                  primary
                  disabled={!changeList.length || stale || !reviewed}
                  onClick={() => {
                    setSummary("");
                    setModal("publish");
                  }}
                >
                  <Upload size={15} />
                  Publish changes
                </Button>
                <span className="planner-muted">
                  {reviewed
                    ? "Publishes and activates in development"
                    : "Review your latest changes before publishing"}
                </span>
              </>
            ) : (
              <Button
                primary
                onClick={() =>
                  attempt(async () =>
                    openDraft(
                      await commit(
                        mine ? service.load() : service.createDraft(owner),
                      ),
                    ),
                  )
                }
              >
                {mine ? "Resume draft" : "Create draft"}
              </Button>
            )}
          </div>
        </div>
        {isDraft && (
          <div className="planner-stepper" aria-label="Artefact workflow">
            {["Draft", "Review", "Publish"].map((label, i) => (
              <React.Fragment key={label}>
                <span
                  className={
                    step === i + 1 ? "current" : step > i + 1 ? "completed" : ""
                  }
                  aria-current={step === i + 1 ? "step" : undefined}
                >
                  <b>{step > i + 1 ? <Check size={12} /> : i + 1}</b>
                  {label}
                </span>
                {i < 2 && <ArrowRight size={12} />}
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="planner-workflow-nav">
          <div>
            {(["development", "draft", "publications"] as View[]).map((v) => (
              <button
                key={v}
                data-planner-tour={v}
                aria-pressed={view === v}
                disabled={v === "draft" && !mine}
                onClick={() => {
                  if (v === "draft" && isDraft) return;
                  if (v === "draft")
                    attempt(async () =>
                      openDraft(await commit(service.load())),
                    );
                  else if (view === "draft" && dirty)
                    attempt(async () => {
                      await saveNow();
                      setView(v);
                      setWorking(null);
                    });
                  else {
                    setView(v);
                    setWorking(null);
                  }
                }}
              >
                {v === "development"
                  ? "Active development"
                  : v === "draft"
                    ? "Your draft"
                    : "Publications"}
                {v === "publications" && (
                  <small>{store.publications.length}</small>
                )}
              </button>
            ))}
          </div>
          <div className="planner-guide-links">
            <span className="planner-muted">
              {store.development.publicationId}
            </span>
            {AGENT_TOUR_ENABLED && (
              <button className="button" onClick={beginTour}>
                Draft guide
              </button>
            )}
          </div>
        </div>
        <div className="planner-content">
          {AGENT_TOUR_ENABLED && !tourDismissed && (
            <div className="planner-tour-welcome">
              <div>
                <strong>New to drafts?</strong>
                <p>
                  Take a quick guided tour from your first draft to publishing.
                </p>
              </div>
              <Button onClick={beginTour}>Take a tour</Button>
              <button
                className="icon-btn"
                aria-label="Dismiss tour invitation"
                onClick={dismissTour}
              >
                ?
              </button>
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
              {isDraft && (
                <Button
                  onClick={() =>
                    attempt(async () => {
                      if (
                        confirm(
                          "Replace the open edits with the last saved draft?",
                        )
                      )
                        openDraft(await commit(service.load()));
                    })
                  }
                >
                  Reload saved draft
                </Button>
              )}
            </div>
          )}
          {view === "development" && (
            <div className="planner-notice">
              <ShieldCheck size={18} />
              <div>
                <strong>
                  Development v{store.development.version} is active
                </strong>
                <p>
                  {mine
                    ? "You have a saved draft based on v" +
                      mine.baselineVersion +
                      ". Resume it to continue without changing the active package."
                    : "Create a draft to work independently. Publish your changes to make them active in development."}
                </p>
              </div>
            </div>
          )}
          {isDraft && (
            <div
              className={
                "planner-notice " + (stale ? "warning" : "draft-notice")
              }
            >
              <GitBranch size={18} />
              <div>
                <strong>
                  {stale
                    ? "Development has advanced to v" +
                      store.development.version
                    : "Isolated draft · " + owner}
                </strong>
                <p>
                  {stale
                    ? "This draft is based on v" +
                      mine.baselineVersion +
                      ". Review and update your draft before publishing."
                    : reviewed
                      ? "Changes reviewed. You can publish now, or continue editing and review again."
                      : "Autosaved as you work. Review your latest changes when ready to publish."}
                </p>
              </div>
              {stale && (
                <Button onClick={beginUpdate}>Update against latest</Button>
              )}
              <span data-planner-tour="review">
                <Button
                  onClick={() =>
                    setReview({
                      draftId,
                      before: mine.baseline,
                      after: working!,
                      label:
                        "Baseline v" + mine.baselineVersion + " → your draft",
                    })
                  }
                >
                  <GitCompareArrows size={15} />
                  Review changes ({changeList.length})
                </Button>
              </span>
            </div>
          )}
          {view === "publications" ? (
            <section className="planner-publications">
              <div className="section-title">
                <div>
                  <h3>Published snapshots</h3>
                  <p>
                    Version history. Publishing saves an immutable version and
                    activates it in development.
                  </p>
                </div>
                <History size={21} />
              </div>
              {[...store.publications].reverse().map((p) => {
                const active = p.id === store.development.publicationId,
                  released = store.releases.some(
                    (r) => r.publicationId === p.id,
                  );
                return (
                  <article className="planner-publication" key={p.id}>
                    <div className="planner-publication-heading">
                      <strong>{p.id}</strong>
                      <Badge tone={active ? "green" : "neutral"}>
                        {active
                          ? "Active in development"
                          : released
                            ? "Previous version"
                            : "Archived snapshot"}
                      </Badge>
                    </div>
                    <h4>{p.summary}</h4>
                    <p>
                      Published by{" "}
                      {DEMO_USERS.find((u) => u.id === p.author)?.name ??
                        p.author}{" "}
                      · {new Date(p.createdAt).toLocaleString()} · Baseline v
                      {p.baselineVersion} ({p.baselineId})
                    </p>
                    <div className="planner-publication-actions">
                      <Button
                        onClick={() =>
                          setReview({
                            before: p.baseline,
                            after: p.content,
                            label: p.id + " · immutable snapshot",
                          })
                        }
                      >
                        View snapshot & changes
                      </Button>
                      <Button
                        disabled={!!mine}
                        onClick={() =>
                          attempt(async () =>
                            openDraft(
                              await commit(service.createDraft(owner, p.id)),
                            ),
                          )
                        }
                      >
                        Create draft from snapshot
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <>
              <div
                className="tabs"
                role="tablist"
                aria-label={`${agent.name} configuration`}
                data-planner-tour="artefact-tabs"
              >
                {visibleTabs.map(({ name, icon: Icon }) => (
                  <button
                    role="tab"
                    key={name}
                    id={`agent-tab-${name.replaceAll(" ", "-")}`}
                    aria-controls="agent-editor-panel"
                    tabIndex={tab === name ? 0 : -1}
                    onKeyDown={(e) => {
                      const index = visibleTabs.findIndex(
                        (t) => t.name === name,
                      );
                      const target =
                        e.key === "ArrowRight"
                          ? (index + 1) % visibleTabs.length
                          : e.key === "ArrowLeft"
                            ? (index + visibleTabs.length - 1) %
                              visibleTabs.length
                            : e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? visibleTabs.length - 1
                                : -1;
                      if (target >= 0) {
                        e.preventDefault();
                        setTab(visibleTabs[target].name);
                        document
                          .getElementById(
                            `agent-tab-${visibleTabs[target].name.replaceAll(" ", "-")}`,
                          )
                          ?.focus();
                      }
                    }}
                    aria-selected={tab === name}
                    className={tab === name ? "selected" : ""}
                    onClick={() => {
                      setTab(name);
                    }}
                  >
                    <Icon size={16} />
                    {name}
                    <span>{count(name)}</span>
                  </button>
                ))}
              </div>
              <EditModeContext.Provider value={isDraft && !busy}>
                <div
                  className="planner-editor"
                  id="agent-editor-panel"
                  role="tabpanel"
                  aria-labelledby={`agent-tab-${tab.replaceAll(" ", "-")}`}
                  data-planner-tour="editor"
                  key={view + owner + draftId}
                >
                  {tab === "Skills" && (
                    <SkillPackageEditor
                      files={content.files}
                      onChange={(files) => patch({ files })}
                      source={`${agent.name} package`}
                      downloadable
                      downloadPrefix={agent.id}
                      setError={setError}
                    />
                  )}
                  {capabilities.workerDefinitions &&
                    tab === "Worker Definitions" && (
                      <WorkerRegistryViewer
                        files={content.workerFiles ?? {}}
                        onChange={(workerFiles) => patch({ workerFiles })}
                        setError={setError}
                      />
                    )}
                  {tab === "Prompts" && (
                    <PromptEditor
                      prompts={content.prompts}
                      onChange={(prompts) => patch({ prompts })}
                      role={agent.role}
                    />
                  )}
                  {tab === "Models" && (
                    <Models
                      agent={currentAgent}
                      data={editorData}
                      usageAgents={data.agents}
                      onChange={(models) => patch({ models })}
                      onAssign={(modelIds) => patch({ modelIds })}
                    />
                  )}
                </div>
              </EditModeContext.Provider>
            </>
          )}
          <details className="planner-scenarios">
            <summary>Workflow walkthrough</summary>
            <p>
              Use these controls to explore parallel drafts and release
              ordering. They simulate users and publishing in this browser; they
              do not access a backend or change the hosted site.
            </p>
            <div className="planner-scenario-controls">
              <label>
                Act as
                <select
                  aria-label="Act as"
                  value={owner}
                  disabled={dirty}
                  onChange={(e) => {
                    setOwner(e.target.value);
                    setView("development");
                    setWorking(null);
                    setError("");
                  }}
                >
                  {owners.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={() => setModal("advance")}>
                Simulate development update
              </Button>
              <Button onClick={() => setModal("reset")}>
                Reset walkthrough
              </Button>
            </div>
            <p>
              {Object.keys(store.drafts).length} open draft(s):{" "}
              {Object.keys(store.drafts)
                .map((id) => DEMO_USERS.find((u) => u.id === id)?.name ?? id)
                .join(", ") || "none"}
              . No exclusive locks.
            </p>
          </details>
        </div>
        <footer className="workspace-footer" data-planner-tour="draft-footer">
          <span
            className={dirty ? "dirty-indicator" : "saved-indicator"}
            role="status"
          >
            <ShieldCheck size={15} />
            {isDraft
              ? dirty
                ? status || "Unsaved changes"
                : status || "Draft saved"
              : status === "Published and active"
                ? status
                : "Viewing " +
                  (view === "publications"
                    ? "immutable publications"
                    : "development v" + store.development.version)}
          </span>
          <div>
            {isDraft ? (
              <>
                <Button onClick={() => leave()}>Exit draft</Button>
                <Button onClick={() => setModal("discard")}>
                  Discard draft
                </Button>
                <Button primary onClick={() => attempt(() => saveNow())}>
                  <Save size={15} />
                  Save draft
                </Button>
              </>
            ) : (
              <span className="planner-muted">
                {mine
                  ? "Saved draft available for " + ownerName
                  : "Changes begin in a separate draft"}
              </span>
            )}
          </div>
        </footer>
        {AGENT_TOUR_ENABLED && tourOpen && (
          <AgentDraftTour
            workerDefinitions={capabilities.workerDefinitions}
            isDraft={isDraft}
            hasDraft={!!store.drafts[owner]}
            onClose={dismissTour}
            startDraft={() => {
              if (!isDraft) {
                const sandbox = copy(tourStore ?? store);
                const next = sandbox.drafts[owner]
                  ? sandbox
                  : createDraft(sandbox, owner);
                setTourStore(next);
                openDraft(next);
              }
            }}
          />
        )}
        {review && (
          <ReviewDialog
            before={review.before}
            after={review.after}
            label={review.label}
            error={error}
            onReturn={() => setReview(null)}
            onClose={closeReview}
          />
        )}
        {modal && (
          <Dialog
            title={
              modal === "publish"
                ? "Publish changes to development?"
                : modal === "discard"
                  ? "Discard your draft?"
                  : modal === "advance"
                    ? "Advance development?"
                    : modal === "reset"
                      ? "Reset the walkthrough?"
                      : "Save before leaving?"
            }
            eyebrow={`${agent.name.toUpperCase()} PACKAGE`}
            onClose={() => {
              if (!busyRef.current) setModal(null);
            }}
          >
            <div className="dialog-body">
              {modal === "publish" ? (
                <>
                  <p>
                    Publish {changeList.length} changed artefact(s) based on
                    development v{mine?.baselineVersion}. This saves your latest
                    edits, creates an immutable version, and makes it active in
                    development. Your draft will close.
                  </p>
                  {stale && (
                    <div className="alert">
                      A newer version is available. Review and update your draft
                      before publishing.
                    </div>
                  )}
                  <label>
                    Change summary
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Describe what changed and why"
                      rows={3}
                    />
                  </label>
                </>
              ) : (
                <p>
                  {modal === "discard"
                    ? "Delete your saved draft and its unsaved edits? Development, publications, and other users’ drafts will remain unchanged."
                    : modal === "advance"
                      ? "Simulate another user publishing new agent guidance. Existing drafts keep their original baseline and become stale."
                      : modal === "reset"
                        ? "Remove all walkthrough drafts, publications, and simulated releases, and restore the starting agent package?"
                        : "Save your current edits to return later, or leave with only the last saved draft retained."}
                </p>
              )}
            </div>
            <footer className="dialog-footer">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              {(modal === "exit" || modal === "close") && (
                <Button
                  onClick={() => {
                    const closing = modal === "close";
                    setModal(null);
                    setWorking(null);
                    setView("development");
                    if (closing) onClose();
                  }}
                >
                  Exit without saving
                </Button>
              )}
              <Button
                primary
                disabled={modal === "publish" && (stale || !reviewed)}
                onClick={() =>
                  attempt(async () => {
                    if (modal === "publish") {
                      await commit(service.publish(draftRef(), summary));
                      setView("publications");
                      setWorking(null);
                      setStatus("Published and active");
                    } else if (modal === "discard") {
                      await commit(service.discardDraft(draftRef()));
                      setWorking(null);
                      setView("development");
                    } else if (modal === "advance") {
                      await commit(service.simulateUpdate());
                    } else if (modal === "reset") {
                      await commit(service.reset());
                      setWorking(null);
                      setView("development");
                      setError("");
                    } else {
                      const closing = modal === "close";
                      await saveNow();
                      setWorking(null);
                      setView("development");
                      if (closing) onClose();
                    }
                    setModal(null);
                  })
                }
              >
                {modal === "publish"
                  ? "Confirm publication"
                  : modal === "discard"
                    ? "Delete draft"
                    : modal === "advance"
                      ? "Advance development"
                      : modal === "reset"
                        ? "Reset walkthrough"
                        : "Save and exit"}
              </Button>
            </footer>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
          </Dialog>
        )}
        {rebasing && (
          <Dialog
            title="Update draft against latest"
            eyebrow={
              "BASELINE v" +
              mine?.baselineVersion +
              " → DEVELOPMENT v" +
              rebasing.targetVersion
            }
            onClose={() => {
              if (!busyRef.current) setRebasing(null);
            }}
            wide
          >
            <div className="planner-merge-body">
              <p>
                Uncontested changes are combined automatically. Resolve
                conflicting artefacts below. Existing publications are never
                modified.
              </p>
              {rebasing.plan.conflicts.length === 0 ? (
                <div className="planner-notice">
                  <Check />
                  No conflicts. Your changes can be carried onto the latest
                  development package.
                </div>
              ) : (
                rebasing.plan.conflicts.map((path) => (
                  <section className="planner-conflict" key={path}>
                    <h4>{path}</h4>
                    <div className="planner-three-way">
                      {[
                        ["Original baseline", rebasing.plan.base[path]],
                        ["Your draft", rebasing.plan.mine[path]],
                        ["Latest development", rebasing.plan.latest[path]],
                      ].map(([label, text]) => (
                        <div key={label}>
                          <strong>{label}</strong>
                          <pre>{text ?? "(File deleted)"}</pre>
                        </div>
                      ))}
                    </div>
                    <label>
                      Resolution for {path}
                      <select
                        value={resolutions[path] || ""}
                        onChange={(e) => {
                          setResolutions((r) => ({
                            ...r,
                            [path]: e.target.value,
                          }));
                          setResolutionText((r) => ({
                            ...r,
                            [path]: r[path] ?? rebasing.plan.mine[path] ?? "",
                          }));
                        }}
                      >
                        <option value="">Choose a resolution</option>
                        <option value="mine">Keep my draft version</option>
                        <option value="latest">
                          Use latest development version
                        </option>
                        <option value="manual">Combine manually</option>
                      </select>
                    </label>
                    {resolutions[path] === "manual" && (
                      <textarea
                        aria-label={"Merged content for " + path}
                        className="planner-merge-input"
                        value={resolutionText[path] || ""}
                        onChange={(e) =>
                          setResolutionText((r) => ({
                            ...r,
                            [path]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </section>
                ))
              )}
            </div>
            <footer className="dialog-footer">
              <Button onClick={() => setRebasing(null)}>Cancel</Button>
              <Button
                primary
                disabled={rebasing.plan.conflicts.some((p) => !resolutions[p])}
                onClick={finishUpdate}
              >
                Save updated draft
              </Button>
            </footer>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
          </Dialog>
        )}
      </fieldset>
    </Dialog>
  );
}
function ReviewDialog({
  before,
  after,
  label,
  onClose,
  onReturn,
  error,
}: {
  before: AgentPackage;
  after: AgentPackage;
  label: string;
  error: string;
  onReturn: () => void;
  onClose: () => void;
}) {
  const diffs = changes(before, after);
  const [path, setPath] = useState(diffs[0]?.path || "");
  const selected = diffs.find((d) => d.path === path);
  const [all, setAll] = useState(false);
  return (
    <Dialog title="Review changes" eyebrow={label} onClose={onClose} wide>
      <div className="planner-review">
        <aside>
          <strong>{diffs.length} changed artefact(s)</strong>
          {diffs.map((d) => (
            <button
              key={d.path}
              className={d.path === path ? "selected" : ""}
              onClick={() => setPath(d.path)}
            >
              <Badge tone={d.kind === "Deleted" ? "amber" : "neutral"}>
                {d.kind}
              </Badge>
              <span>{d.path}</span>
            </button>
          ))}
          <Button onClick={() => setAll(!all)}>
            {all ? "Hide complete snapshot" : "View complete snapshot"}
          </Button>
        </aside>
        <section>
          {all ? (
            <pre className="planner-full-snapshot">
              {JSON.stringify(after, null, 2)}
            </pre>
          ) : selected ? (
            <>
              <div className="planner-diff-title">
                <strong>{selected.path}</strong>
                <span>Only changed lines highlighted</span>
              </div>
              <ReviewDiff
                key={selected.path}
                before={selected.before}
                after={selected.after}
              />
            </>
          ) : (
            <div className="empty-state">
              <Check />
              <h3>No changes from baseline</h3>
              <p>Edit a draft artefact to see its changes here.</p>
            </div>
          )}
        </section>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <footer className="dialog-footer">
        {error && <Button onClick={onReturn}>Return to draft</Button>}
        <Button onClick={onClose}>Close review</Button>
      </footer>
    </Dialog>
  );
}
