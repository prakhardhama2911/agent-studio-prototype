import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Dialog } from "./ui";
import { SkillPackageEditor } from "./SkillPackageEditor";
import { validateFile } from "./lib/core.mjs";
import type { Agent, Group } from "./types";

// Deliberately fictional input catalog: no backend or database reads.
const pages = [
  {
    key: "p_rsv_vs_distribution",
    name: "Distribution Opportunity Analysis",
    description:
      "Compare sales performance with distribution to identify growth opportunities.",
    metric: "Relative sales value",
    dimensions: "Country, category, brand",
  },
  {
    key: "p_market_segments",
    name: "Market Segment Analysis",
    description:
      "Explore segment size, share and growth within a selected category.",
    metric: "Market share",
    dimensions: "Country, category, segment",
  },
  {
    key: "p_brand_growth",
    name: "Brand Growth Analysis",
    description:
      "Review brand growth over time and identify the strongest contributors.",
    metric: "Sales growth",
    dimensions: "Country, category, brand, period",
  },
];
type Page = (typeof pages)[number];
const stages = ["Contract ready", "Planner package", "Active"];

export function PageBackedImport({
  group,
  existingAgents,
  onClose,
  onActivate,
}: {
  group: Group;
  existingAgents: Agent[];
  onClose: () => void;
  onActivate: (agent: Agent) => Promise<void>;
}) {
  const [pageKey, setPageKey] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [id] = useState(() => crypto.randomUUID());
  const [files, setFiles] = useState<Record<string, string>>({});
  const [plannerFiles, setPlannerFiles] = useState<Record<string, string>>({});
  const [savedFiles, setSavedFiles] = useState("");
  const [savedPlannerFiles, setSavedPlannerFiles] = useState("");
  const [notice, setNotice] = useState("");
  const active = stage === 2;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (page && !active) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [page, active]);
  const dirty =
    stage === 0
      ? JSON.stringify(files) !== savedFiles
      : JSON.stringify(plannerFiles) !== savedPlannerFiles;
  const close = () => {
    if (busy) return;
    if (
      !page ||
      active ||
      confirm(
        "Discard this unfinished import? Package saves are kept only within this import until activation.",
      )
    )
      onClose();
  };
  const validate = (packageFiles: Record<string, string>) => {
    if (!packageFiles["SKILL.md"]?.trim())
      throw Error("The package must contain a non-empty SKILL.md file.");
    for (const [path, content] of Object.entries(packageFiles)) {
      const message = validateFile(path, content);
      if (message) throw Error(`${path}: ${message}`);
    }
  };
  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    const selected = pages.find((item) => item.key === pageKey.trim());
    if (!selected) {
      setError(
        "Page not found in the sample catalog. Choose one of the example page keys below.",
      );
      return;
    }
    if (
      existingAgents.some(
        (agent) => agent.pageBinding?.pageKey === selected.key,
      )
    ) {
      setError(
        "This page is already bound to a sub-agent. Choose another page key.",
      );
      return;
    }
    setBusy(true);
    // Short local delay makes the generation step visible without any network call.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const generated = {
      "SKILL.md": `# ${selected.name}\n\n${selected.description}\n\n## Execution\nUse the approved page ${selected.key}. Require country and category inputs.\nReport ${selected.metric.toLowerCase()} using validated page evidence.\n\n## Limits\nDescribe missing data and avoid unsupported conclusions.\n`,
      "references/page-context.md": `# Page context\n\nPage: ${selected.key}\nMetric: ${selected.metric}\nDimensions: ${selected.dimensions}\n\nUse this context when explaining the analysis.\n`,
    };
    const planner = {
      "SKILL.md": `# Planner selection: ${selected.name}\n\nSelect the page-backed sub-agent for ${selected.description.toLowerCase()}\nPage key: ${selected.key}\nConfirm country, category, metric and dimensions before including this sub-agent in the plan.\n`,
    };
    setFiles(generated);
    setPlannerFiles(planner);
    setSavedFiles(JSON.stringify(generated));
    setSavedPlannerFiles(JSON.stringify(planner));
    setPage(selected);
    setStage(0);
    setBusy(false);
  };
  const save = () => {
    try {
      validate(stage === 0 ? files : plannerFiles);
      if (stage === 0) setSavedFiles(JSON.stringify(files));
      else setSavedPlannerFiles(JSON.stringify(plannerFiles));
      setError("");
      setNotice(
        "Package saved for this import. Activate to retain it in your studio session.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const activate = async () => {
    if (!page || busy || dirty) return;
    try {
      validate(files);
      validate(plannerFiles);
      setError("");
      setBusy(true);
      await onActivate({
        id,
        name: page.name,
        description: page.description,
        role: "worker",
        groupId: group.id,
        scope: page.dimensions,
        instructions: page.description,
        files,
        prompts: [
          {
            id: crypto.randomUUID(),
            name: "System instructions",
            purpose: "Run the bound page analysis.",
            content: `You are ${page.name}.\nUse page ${page.key} to answer {{question}} within {{scope}}.\nReport evidence and limitations.`,
          },
        ],
        modelIds: [],
        origin: "Local draft",
        pageBinding: {
          pageKey: page.key,
          metric: page.metric,
          dimensions: page.dimensions,
          plannerFiles: plannerFiles,
        },
      });
      setStage(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={page ? page.name : "Bind an approved application page"}
      eyebrow={`${group.name} / New sub-agent`}
      onClose={close}
      wide={!!page}
    >
      <div className="dialog-body page-import">
        <p className="page-import-note">
          Sample page catalog � No backend connection. Activation is simulated
          within your locked studio session.
        </p>
        {!page ? (
          <form onSubmit={generate}>
            <p>
              Enter a page key to generate the complete, page-backed sub-agent
              template. Its contract cannot be manually edited.
            </p>
            <label>
              pageKey
              <input
                autoFocus
                required
                minLength={2}
                maxLength={200}
                value={pageKey}
                disabled={busy}
                onChange={(event) => setPageKey(event.target.value)}
                placeholder="p_rsv_vs_distribution"
              />
            </label>
            <p className="field-help">
              Edit the generated skill packages before activating the sub-agent.
            </p>
            <div className="page-import-examples">
              <strong>Example page keys</strong>
              {pages.map((item) => (
                <button
                  type="button"
                  disabled={busy}
                  key={item.key}
                  onClick={() => {
                    setPageKey(item.key);
                    setError("");
                  }}
                >
                  <code>{item.key}</code>
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            <footer className="dialog-footer">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={busy || !pageKey.trim()}
              >
                {busy ? "Generating..." : "Generate from page"}
              </button>
            </footer>
          </form>
        ) : (
          <>
            <ol className="page-import-steps" aria-label="Lifecycle progress">
              {stages.map((name, index) => (
                <li
                  key={name}
                  aria-current={stage === index ? "step" : undefined}
                >
                  <span>{index + 1}</span>
                  {name}
                </li>
              ))}
            </ol>
            <details className="page-import-contract">
              <summary>Page-bound contract � {page.key}</summary>
              <dl>
                <dt>Analysis</dt>
                <dd>{page.name}</dd>
                <dt>Metric</dt>
                <dd>{page.metric}</dd>
                <dt>Dimensions</dt>
                <dd>{page.dimensions}</dd>
              </dl>
              <p>The generated contract is read-only.</p>
            </details>
            {!active ? (
              <>
                {stage === 1 && (
                  <p className="page-import-note">
                    Review the generated Planner package for this import. Define
                    when the Planner should select this sub-agent.
                  </p>
                )}
                <SkillPackageEditor
                  key={stage}
                  files={stage === 0 ? files : plannerFiles}
                  onChange={(value) => {
                    if (busy) return;
                    stage === 0 ? setFiles(value) : setPlannerFiles(value);
                    setNotice("");
                  }}
                  source="Generated sample page"
                  downloadable
                  downloadPrefix={
                    stage === 0 ? page.key : `${page.key}-planner`
                  }
                  readOnly={busy}
                  setError={setError}
                />
                {notice && <p role="status">{notice}</p>}
                {error && (
                  <div className="alert" role="alert">
                    {error}
                  </div>
                )}
                <footer className="dialog-footer">
                  <Button disabled={busy} onClick={close}>
                    Cancel import
                  </Button>
                  {stage === 1 && (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setStage(0);
                        setError("");
                        setNotice("");
                      }}
                    >
                      Back to sub-agent package
                    </Button>
                  )}
                  <Button disabled={busy || !dirty} onClick={save}>
                    Save file(s)
                  </Button>
                  {stage === 0 ? (
                    <Button
                      primary
                      disabled={dirty || busy}
                      onClick={() => {
                        try {
                          validate(files);
                          setStage(1);
                          setError("");
                          setNotice("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Next: Planner package
                    </Button>
                  ) : (
                    <Button
                      primary
                      disabled={dirty || busy}
                      onClick={() => void activate()}
                    >
                      {busy ? "Activating..." : "Activate sub-agent"}
                    </Button>
                  )}
                </footer>
              </>
            ) : (
              <section className="page-import-success" role="status">
                <CheckCircle2 size={32} />
                <h3>Sub-agent activated in your edit session</h3>
                <p>
                  {page.name} is now listed in {group.name}. Exit edit mode to
                  make it visible to other users.
                </p>
                <p>This does not activate a running backend agent.</p>
                <Button primary onClick={onClose}>
                  Done
                </Button>
              </section>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
