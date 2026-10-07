import React from "react";
import { useEditMode } from "./EditModeContext";
import { SourceLine } from "./SourceLine";

/** The source layer defines the canvas size; the native input keeps selection,
 * keyboard editing, undo, and accessibility while both share one scroll area. */
export function SkillCodeEditor({
  path,
  content,
  onChange,
  wrap,
}: {
  path: string;
  content: string;
  onChange: (content: string) => void;
  wrap: boolean;
}) {
  const editing = useEditMode();
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const end = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const yaml = /\.ya?ml$/i.test(path);
  return (
    <div className={`skills-edit-surface ${wrap ? "wrap" : ""}`}>
      <div className="skills-code-canvas">
        <div className="registry-lines skills-highlight" aria-hidden="true">
          {lines.map((line, index) => (
            <div className="registry-line" key={index}>
              <span className="registry-line-number">{index + 1}</span>
              <code>
                <SourceLine
                  line={line}
                  frontmatter={yaml || (index > 0 && index < end)}
                />
              </code>
            </div>
          ))}
        </div>
        <textarea
          readOnly={!editing}
          className="skills-text-input"
          aria-label={`Edit ${path}`}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap={wrap ? "soft" : "off"}
          value={content}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
