import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Search,
  Trash2,
  WrapText,
  X,
} from "lucide-react";
import { validateFile, validatePath } from "./lib/core.mjs";
import { SkillCodeEditor } from "./SkillCodeEditor";
export function SkillPackageEditor({
  files,
  onChange,
  source,
  kind = "skills",
  setError,
}: {
  files: Record<string, string>;
  onChange: (f: Record<string, string>) => void;
  source: string;
  kind?: "skills" | "workers";
  setError: (e: string) => void;
}) {
  const isRegistry = kind === "workers";
  const root = isRegistry ? "worker-registry" : "skills";
  const [path, setPath] = useState(Object.keys(files)[0] || "");
  const [preview, setPreview] = useState(false);
  const [opened, setOpened] = useState<string[]>(
    Object.keys(files).length ? [Object.keys(files)[0]] : [],
  );
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rootExpanded, setRootExpanded] = useState(true);
  const choose = (nextPath: string) => {
    setPath(nextPath);
    setPreview(false);
    setCopied(false);
    setOpened((current) =>
      current.includes(nextPath) ? current : [...current, nextPath],
    );
    setCollapsed((current) =>
      current.filter((folder) => !nextPath.startsWith(folder + "/")),
    );
  };
  const closeTab = (closing: string) => {
    const remaining = opened.filter(
      (item) => item !== closing && item in files,
    );
    if (!remaining.length) return;
    setOpened(remaining);
    if (path === closing) setPath(remaining[remaining.length - 1]);
  };
  useEffect(() => {
    setOpened((current) => {
      const valid = current.filter((item) => item in files);
      const next = valid.length ? valid : Object.keys(files).slice(0, 1);
      return current.join("\n") === next.join("\n") ? current : next;
    });
    if (!(path in files)) setPath(Object.keys(files)[0] || "");
  }, [files, path]);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState<"file" | "folder" | null>(null);
  const [newPath, setNewPath] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);
  const add = () => {
    const p = newPath.trim().replaceAll("\\", "/").replace(/\/$/, "");
    if (adding === "folder") {
      if (
        !p ||
        p.split("/").some((x) => !x || x === ".." || x === ".") ||
        p.startsWith("/")
      ) {
        setError("Use a safe relative folder name.");
        return;
      }
      setFolders([...folders, p]);
      setNewPath(p + (isRegistry ? "/definition.md" : "/SKILL.md"));
      setAdding("file");
      setError("");
      return;
    }
    if (!validatePath(p)) {
      setError("Use a relative path with a supported text-file extension.");
      return;
    }
    if (p in files) {
      setError("A file with that path already exists.");
      return;
    }
    onChange({
      ...files,
      [p]: p.endsWith(".json")
        ? "{}\n"
        : p.endsWith(".md")
          ? "# New document\n"
          : "Add content here.\n",
    });
    choose(p);
    setAdding(null);
    setNewPath("");
    setError("");
  };
  const importFiles = async (list: FileList | null) => {
    if (!list) return;
    const next = { ...files };
    let first = "";
    try {
      for (const file of Array.from(list)) {
        const p = (file.webkitRelativePath || file.name).replaceAll("\\", "/");
        if (file.size > 2 * 1024 * 1024)
          throw Error(`${p}: maximum file size is 2 MB.`);
        if (!validatePath(p))
          throw Error(`${p}: unsupported file type or unsafe path.`);
        const content = await file.text();
        const error = validateFile(p, content);
        if (error) throw Error(`${p}: ${error}`);
        if (p in next && !confirm(`Replace ${p} in this package?`)) continue;
        next[p] = content;
        first ||= p;
      }
      onChange(next);
      if (first) choose(first);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const paths = Object.keys(files).sort();
  const tree = Array.from(
    new Set([
      ...folders,
      ...paths.flatMap((p) =>
        p
          .split("/")
          .slice(0, -1)
          .map((_, i) =>
            p
              .split("/")
              .slice(0, i + 1)
              .join("/"),
          ),
      ),
      ...paths,
    ]),
  ).sort();
  return (
    <>
      <div className="section-title">
        <div>
          <h3>{isRegistry ? "Worker definitions package" : "Skill package"}</h3>
          <p>
            {isRegistry
              ? "Worker definitions and supporting files used by the Planner."
              : "Instructions and supporting files, organized in one package."}
          </p>
        </div>
      </div>
      <div className="registry-ide skills-ide">
        <aside
          className="registry-explorer skills-explorer"
          aria-label={
            isRegistry
              ? "Worker registry file explorer"
              : "Skill package file explorer"
          }
        >
          <div className="sidebar-title">
            <span>EXPLORER</span>
            <span>{paths.length} files</span>
          </div>
          <div className="file-tools">
            <button
              title="Add file"
              aria-label="Add file"
              onClick={() => {
                setAdding("file");
                setNewPath("");
              }}
            >
              <FilePlus2 size={17} />
            </button>
            <button
              title="Add folder"
              aria-label="Add folder"
              onClick={() => {
                setAdding("folder");
                setNewPath("");
              }}
            >
              <FolderPlus size={17} />
            </button>
            <button
              title="Import files"
              aria-label="Import files"
              onClick={() => fileInput.current?.click()}
            >
              <ArrowUpFromLine size={17} />
            </button>
            <button
              title="Import folder"
              aria-label="Import folder"
              onClick={() => folderInput.current?.click()}
            >
              <FolderOpen size={17} />
            </button>
          </div>
          <div className="mini-search">
            <Search size={13} />
            <input
              aria-label="Filter package files"
              placeholder="Find a file…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {adding && (
            <div className="add-path">
              <label>
                {adding === "folder" ? "New folder" : "New file"}
                <input
                  autoFocus
                  placeholder={
                    adding === "folder" ? "references" : "references/guide.md"
                  }
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                />
              </label>
              <div>
                <button onClick={add}>Add</button>
                <button onClick={() => setAdding(null)}>Cancel</button>
              </div>
            </div>
          )}
          <button
            className="registry-root"
            aria-expanded={rootExpanded}
            onClick={() => setRootExpanded(!rootExpanded)}
          >
            <ChevronDown
              size={14}
              className={rootExpanded ? "" : "collapsed"}
            />
            <FolderOpen size={15} />
            <strong>{root}</strong>
          </button>
          <div className="file-tree" hidden={!rootExpanded}>
            {tree
              .filter(
                (p) =>
                  p.toLowerCase().includes(filter.toLowerCase()) &&
                  (!filter
                    ? !collapsed.some((f) => p.startsWith(f + "/"))
                    : true),
              )
              .map((p) => {
                const isFile = p in files;
                const depth = p.split("/").length - 1;
                return (
                  <button
                    title={p}
                    key={p}
                    style={{ paddingLeft: 12 + depth * 14 }}
                    className={path === p ? "selected" : ""}
                    aria-current={isFile && path === p ? "true" : undefined}
                    aria-expanded={!isFile ? !collapsed.includes(p) : undefined}
                    onClick={() =>
                      isFile
                        ? choose(p)
                        : setCollapsed((c) =>
                            c.includes(p)
                              ? c.filter((x) => x !== p)
                              : [...c, p],
                          )
                    }
                  >
                    {isFile ? <FileText size={15} /> : <Folder size={15} />}
                    <span>{p.split("/").pop()}</span>
                    {!isFile && (
                      <ChevronRight
                        size={12}
                        className={collapsed.includes(p) ? "" : "expanded"}
                      />
                    )}
                  </button>
                );
              })}
          </div>
          <div className="sidebar-note">
            .md · .json · .yaml · .txt · .csv
            <br />
          </div>
        </aside>
        <section
          className="registry-main skills-main"
          aria-label={
            isRegistry ? "Worker definition editor" : "Skill file editor"
          }
        >
          <div
            className="registry-tabs"
            role="tablist"
            aria-label={isRegistry ? "Open registry files" : "Open skill files"}
          >
            {opened
              .filter((item) => item in files)
              .map((item) => (
                <div
                  className={`registry-tab ${item === path ? "selected" : ""}`}
                  key={item}
                >
                  <button
                    role="tab"
                    aria-selected={item === path}
                    aria-controls="skill-file-panel"
                    id={`skill-tab-${item}`}
                    title={item}
                    onClick={() => choose(item)}
                  >
                    <FileText size={14} />
                    <span>{item}</span>
                  </button>
                  {opened.length > 1 && (
                    <button
                      className="registry-close"
                      aria-label={`Close ${item}`}
                      onClick={() => closeTab(item)}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          <div className="registry-toolbar skills-editor-toolbar">
            <span>
              <Code2 size={14} />
              {root} /{" "}
              <strong title={path}>{path || "No file selected"}</strong>
            </span>
            <div>
              <button
                className={!preview ? "active" : ""}
                onClick={() => setPreview(false)}
              >
                <Code2 size={13} />
                Edit
              </button>
              <button
                className={preview ? "active" : ""}
                onClick={() => setPreview(true)}
              >
                <BookOpen size={13} />
                Preview
              </button>
              {path && (
                <>
                  <button
                    aria-label="Toggle word wrap"
                    title="Toggle word wrap"
                    aria-pressed={wrap}
                    className={wrap ? "active" : ""}
                    onClick={() => setWrap(!wrap)}
                  >
                    <WrapText size={16} />
                  </button>
                  <button
                    aria-label="Copy file contents"
                    title="Copy file contents"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(files[path]);
                        setCopied(true);
                      } catch {
                        setError(
                          "Copy unavailable. Select the text and copy it manually.",
                        );
                      }
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </>
              )}
              {path && (
                <button
                  aria-label="Delete selected file"
                  title="Delete selected file"
                  onClick={() => {
                    if (confirm(`Remove ${path} from this package?`)) {
                      const next = { ...files };
                      delete next[path];
                      onChange(next);
                      setPath(Object.keys(next)[0] || "");
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <div
            className="skills-file-panel"
            role="tabpanel"
            id="skill-file-panel"
            aria-labelledby={path ? `skill-tab-${path}` : undefined}
          >
            {path in files ? (
              preview ? (
                <div className="markdown">
                  {path.endsWith(".md") ? (
                    <ReactMarkdown>{files[path]}</ReactMarkdown>
                  ) : (
                    <pre>{files[path]}</pre>
                  )}
                </div>
              ) : (
                <SkillCodeEditor
                  key={path}
                  path={path}
                  content={files[path]}
                  wrap={wrap}
                  onChange={(content) => {
                    onChange({ ...files, [path]: content });
                    setCopied(false);
                  }}
                />
              )
            ) : (
              <div className="empty-state">
                <FolderOpen />
                <h3>Your package starts here</h3>
                <p>Add a file or import an existing folder.</p>
              </div>
            )}
          </div>
          <div className="registry-status">
            <span>
              {path.endsWith(".md")
                ? "Markdown"
                : path.split(".").pop()?.toUpperCase() || "TEXT"}
            </span>
            <span>
              {copied
                ? "Copied to clipboard"
                : `${files[path]?.split("\n").length || 0} lines`}{" "}
              / UTF-8
            </span>
          </div>
        </section>
      </div>
      <input
        hidden
        ref={fileInput}
        type="file"
        multiple
        accept=".md,.json,.yaml,.yml,.txt,.csv"
        onChange={(e) => {
          void importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={folderInput}
        type="file"
        multiple
        onChange={(e) => {
          void importFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
