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
import {
  PlannerTour,
  PLANNER_TOUR_KEY,
  PLANNER_TOUR_ENABLED,
} from "./PlannerTour";
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
  WORKFLOW_KEY,
  initialWorkflow,
  packageFrom,
  createDraft,
  saveDraft,
  publishDraft,
  simulateAdvance,
  changes,
  mergePlan,
  packageFromArtefacts,
  copy,
} from "./plannerWorkflow";
import type { PlannerPackage, WorkflowState } from "./plannerWorkflow";

type View = "development" | "draft" | "publications";
const owners = ["Prakhar", "Maya"];
const tabs = [
  { name: "Skills", icon: FolderOpen },
  { name: "Prompts", icon: FileText },
  { name: "Worker Definitions", icon: Network },
  { name: "Models", icon: Boxes },
];
function readState(fallback: WorkflowState): WorkflowState {
  const raw = localStorage.getItem(WORKFLOW_KEY);
  if (!raw) return copy(fallback);
  const value = JSON.parse(raw);
  if (
    value.schema !== 1 ||
    !value.development?.content ||
    !value.drafts ||
    !Array.isArray(value.publications) ||
    !Array.isArray(value.releases)
  )
    throw Error(
      "Saved workflow data could not be read. Reset the walkthrough only if you no longer need its drafts.",
    );
  return value;
}
export function PlannerWorkspace({
  data,
  agent,
  onClose,
}: {
  data: StudioData;
  agent: Agent;
  onClose: () => void;
}) {
  const initial = useRef(
    initialWorkflow(packageFrom(data, agent, defaultWorkerFiles)),
  );
  const [store, setStore] = useState<WorkflowState>(() => {
    try {
      return readState(initial.current);
    } catch {
      return initial.current;
    }
  });
  const [error, setError] = useState(() => {
    try {
      readState(initial.current);
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  });
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStore, setTourStore] = useState<WorkflowState | null>(null);
  const tourReturn = useRef<{
    view: View;
    tab: string;
    working: PlannerPackage | null;
    draftId: string;
    revision: number;
    status: string;
    error: string;
    scroll: number;
  } | null>(null);
  const [tourDismissed, setTourDismissed] = useState(() => {
    try {
      return localStorage.getItem(PLANNER_TOUR_KEY) === "seen";
    } catch {
      return false;
    }
  });
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
    try {
      localStorage.setItem(PLANNER_TOUR_KEY, "seen");
    } catch {}
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
  const [owner, setOwner] = useState("Prakhar");
  const [view, setView] = useState<View>("development");
  const [tab, setTab] = useState("Skills");
  const [working, setWorking] = useState<PlannerPackage | null>(null);
  const [draftId, setDraftId] = useState("");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("");
  const [review, setReview] = useState<{
    before: PlannerPackage;
    after: PlannerPackage;
    label: string;
  } | null>(null);
  const [modal, setModal] = useState<
    "publish" | "discard" | "exit" | "close" | "advance" | "reset" | null
  >(null);
  const [summary, setSummary] = useState("");
  const [rebasing, setRebasing] = useState<{
    plan: ReturnType<typeof mergePlan>;
    targetId: string;
    targetVersion: number;
    target: PlannerPackage;
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
  const commit = (update: (state: WorkflowState) => WorkflowState) => {
    const next = update(readState(initial.current));
    localStorage.setItem(WORKFLOW_KEY, JSON.stringify(next));
    setStore(next);
    setError("");
    return next;
  };
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const openDraft = (next: WorkflowState) => {
    const d = next.drafts[owner];
    setWorking(copy(d.content));
    setDraftId(d.id);
    setRevision(d.revision);
    setView("draft");
    setStatus("Draft saved");
    setTab("Skills");
  };
  const saveNow = () => {
    if (!working) throw Error("No draft is open.");
    const next = commit((s) => saveDraft(s, owner, draftId, revision, working));
    setRevision(next.drafts[owner].revision);
    setStatus("Draft saved");
    return next;
  };
  useEffect(() => {
    if (!dirty || rebasing || tourOpen) return;
    setStatus("Saving draft…");
    const timer = setTimeout(() => {
      try {
        saveNow();
      } catch (e) {
        setStatus("Save failed");
        setError((e as Error).message);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [working, view, owner, revision, rebasing, tourOpen]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === WORKFLOW_KEY) {
        try {
          setStore(readState(initial.current));
        } catch (e) {
          setError((e as Error).message);
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const leave = (close = false) => {
    if (dirty) {
      setModal(close ? "close" : "exit");
      return;
    }
    setView("development");
    setWorking(null);
    if (close) onClose();
  };
  const patch = (changes: Partial<PlannerPackage>) => {
    if (isDraft) setWorking((p) => ({ ...p!, ...changes }));
  };
  const currentAgent: Agent = { ...agent, ...content };
  const editorData: StudioData = {
    ...data,
    agents: [currentAgent],
    models: content.models,
  };
  const beginUpdate = () =>
    attempt(() => {
      const next = saveNow(),
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
    attempt(() => {
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
      const next = commit((s) => {
        if (s.development.publicationId !== rebasing.targetId)
          throw Error(
            "Development advanced again. Cancel and reopen the update.",
          );
        const updated = saveDraft(s, owner, draftId, revision, merged);
        updated.drafts[owner] = {
          ...updated.drafts[owner],
          baselineId: rebasing.targetId,
          baselineVersion: rebasing.targetVersion,
          baseline: copy(rebasing.target),
        };
        return updated;
      });
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
          ? Object.keys(content.workerFiles).length
          : content.modelIds.length;
  const step = view === "publications" ? 3 : review ? 2 : 1;
  return (
    <Dialog
      className="planner-dialog"
      title="Planner"
      eyebrow="AGENT STUDIO / PLANNER CONFIGURATION"
      onClose={() => leave(true)}
      wide
    >
      <div className="workspace-summary planner-summary">
        <div className="workspace-symbol planner">
          <Network size={24} />
        </div>
        <div className="planner-summary-copy">
          <div className="summary-badges">
            <Badge tone="green">Planner</Badge>
            <Badge tone={isDraft ? "amber" : "neutral"}>
              {isDraft ? "Your draft" : "Active development"} ·{" "}
              {isDraft
                ? "baseline v" + mine.baselineVersion
                : "v" + store.development.version}
            </Badge>
          </div>
          <p>
            Plan with skills, prompts, worker definitions, and model
            configuration.
          </p>
        </div>
        <div className="workspace-publish" data-planner-tour="draft-action">
          {isDraft ? (
            <>
              <Button
                primary
                disabled={!changeList.length || stale}
                onClick={() => {
                  setSummary("");
                  setModal("publish");
                }}
              >
                <Upload size={15} />
                Publish changes
              </Button>
              <span className="planner-muted">
                Publishes and activates in development
              </span>
            </>
          ) : (
            <Button
              primary
              onClick={() =>
                attempt(() =>
                  openDraft(
                    mine
                      ? readState(initial.current)
                      : commit((s) => createDraft(s, owner)),
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
              <span className={step === i + 1 ? "current" : ""}>
                <b>{i + 1}</b>
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
                  attempt(() => openDraft(readState(initial.current)));
                else if (view === "draft" && dirty)
                  attempt(() => {
                    saveNow();
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
          {PLANNER_TOUR_ENABLED && (
            <button className="button" onClick={beginTour}>
              Draft guide
            </button>
          )}
        </div>
      </div>
      <div className="planner-content">
        {PLANNER_TOUR_ENABLED && !tourDismissed && (
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
                  attempt(() => {
                    if (
                      confirm(
                        "Replace the open edits with the last saved draft?",
                      )
                    )
                      openDraft(readState(initial.current));
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
            className={"planner-notice " + (stale ? "warning" : "draft-notice")}
          >
            <GitBranch size={18} />
            <div>
              <strong>
                {stale
                  ? "Development has advanced to v" + store.development.version
                  : "Isolated draft · " + owner}
              </strong>
              <p>
                {stale
                  ? "This draft is based on v" +
                    mine.baselineVersion +
                    ". Review and update your draft before publishing."
                  : "Autosaved as you work. Other users and the development version are unaffected."}
              </p>
            </div>
            {stale && (
              <Button onClick={beginUpdate}>Update against latest</Button>
            )}
            <span data-planner-tour="review">
              <Button
                onClick={() =>
                  setReview({
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
                released = store.releases.some((r) => r.publicationId === p.id);
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
                    Published by {p.author} ·{" "}
                    {new Date(p.createdAt).toLocaleString()} · Baseline v
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
                        attempt(() =>
                          openDraft(commit((s) => createDraft(s, owner, p))),
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
              aria-label="Planner configuration"
              data-planner-tour="artefact-tabs"
            >
              {tabs.map(({ name, icon: Icon }) => (
                <button
                  role="tab"
                  key={name}
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
            <EditModeContext.Provider value={isDraft}>
              <div
                className="planner-editor"
                data-planner-tour="editor"
                key={view + owner + draftId}
              >
                {tab === "Skills" && (
                  <SkillPackageEditor
                    files={content.files}
                    onChange={(files) => patch({ files })}
                    source="Planner package"
                    downloadable
                    downloadPrefix="planner"
                    setError={setError}
                  />
                )}
                {tab === "Worker Definitions" && (
                  <WorkerRegistryViewer
                    files={content.workerFiles}
                    onChange={(workerFiles) => patch({ workerFiles })}
                    setError={setError}
                  />
                )}
                {tab === "Prompts" && (
                  <PromptEditor
                    prompts={content.prompts}
                    onChange={(prompts) => patch({ prompts })}
                    role="planner"
                  />
                )}
                {tab === "Models" && (
                  <Models
                    agent={currentAgent}
                    data={editorData}
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
            Use these controls to explore parallel drafts and release ordering.
            They simulate users and publishing in this browser; they do not
            access a backend or change the hosted site.
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
                {owners.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <Button onClick={() => setModal("advance")}>
              Simulate development update
            </Button>
            <Button onClick={() => setModal("reset")}>Reset walkthrough</Button>
          </div>
          <p>
            {Object.keys(store.drafts).length} open draft(s):{" "}
            {Object.keys(store.drafts).join(", ") || "none"}. No exclusive
            locks.
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
              <Button onClick={() => setModal("discard")}>Discard draft</Button>
              <Button primary onClick={() => attempt(() => saveNow())}>
                <Save size={15} />
                Save draft
              </Button>
            </>
          ) : (
            <span className="planner-muted">
              {mine
                ? "Saved draft available for " + owner
                : "Changes begin in a separate draft"}
            </span>
          )}
        </div>
      </footer>
      {PLANNER_TOUR_ENABLED && tourOpen && (
        <PlannerTour
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
          onClose={() => setReview(null)}
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
          eyebrow="PLANNER PACKAGE"
          onClose={() => setModal(null)}
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
                    ? "Simulate another user publishing new planning guidance. Existing drafts keep their original baseline and become stale."
                    : modal === "reset"
                      ? "Remove all walkthrough drafts, publications, and simulated releases, and restore the starting Planner package?"
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
              disabled={modal === "publish" && stale}
              onClick={() =>
                attempt(() => {
                  if (modal === "publish") {
                    saveNow();
                    commit((s) => publishDraft(s, owner, summary));
                    setView("publications");
                    setWorking(null);
                    setStatus("Published and active");
                  } else if (modal === "discard") {
                    commit((s) => {
                      const next = copy(s);
                      delete next.drafts[owner];
                      return next;
                    });
                    setWorking(null);
                    setView("development");
                  } else if (modal === "advance") {
                    commit(simulateAdvance);
                  } else if (modal === "reset") {
                    localStorage.setItem(
                      WORKFLOW_KEY,
                      JSON.stringify(initial.current),
                    );
                    setStore(copy(initial.current));
                    setWorking(null);
                    setView("development");
                    setError("");
                  } else {
                    const closing = modal === "close";
                    saveNow();
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
          onClose={() => setRebasing(null)}
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
    </Dialog>
  );
}
function ReviewDialog({
  before,
  after,
  label,
  onClose,
}: {
  before: PlannerPackage;
  after: PlannerPackage;
  label: string;
  onClose: () => void;
}) {
  const diffs = changes(before, after);
  const [path, setPath] = useState(diffs[0]?.path || "");
  const selected = diffs.find((d) => d.path === path);
  const [all, setAll] = useState(false);
  const a = (selected?.before ?? "").split("\n"),
    b = (selected?.after ?? "").split("\n");
  let prefix = 0,
    suffix = 0;
  while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix])
    prefix++;
  while (
    suffix < Math.min(a.length, b.length) - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;
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
                <span>Changed blocks highlighted</span>
              </div>
              <div className="planner-diff-columns">
                {[
                  ["Baseline", a, selected.before],
                  ["Draft / snapshot", b, selected.after],
                ].map(([heading, lines, raw], side) => (
                  <div key={side}>
                    <h4>{heading as string}</h4>
                    <div className="planner-diff-source">
                      {raw === undefined ? (
                        <p className="planner-muted">File not present</p>
                      ) : (
                        (lines as string[]).map((line, i) => (
                          <div
                            className={
                              i >= prefix &&
                              i < (lines as string[]).length - suffix
                                ? side
                                  ? "added"
                                  : "removed"
                                : ""
                            }
                            key={i}
                          >
                            <span>{i + 1}</span>
                            <code>{line || " "}</code>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
      <footer className="dialog-footer">
        <Button onClick={onClose}>Close review</Button>
      </footer>
    </Dialog>
  );
}
