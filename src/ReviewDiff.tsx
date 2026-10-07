import React, { useMemo, useRef } from "react";
import { buildReviewDiff } from "./lineDiff";
export function ReviewDiff({
  before,
  after,
}: {
  before?: string;
  after?: string;
}) {
  const diff = useMemo(() => buildReviewDiff(before, after), [before, after]);
  const panes = useRef<(HTMLDivElement | null)[]>([]);
  if (diff.unavailable)
    return (
      <div className="alert">
        This file is too large to compare interactively. Use View complete
        snapshot to inspect its contents.
      </div>
    );
  return (
    <>
      <div className="planner-diff-summary">
        <span className="diff-add-count">+{diff.added} added</span>
        <span className="diff-remove-count">−{diff.removed} removed</span>
        {diff.lineEndingsOnly && (
          <span>Only line endings changed (CRLF/LF).</span>
        )}
      </div>
      <div className="planner-diff-columns">
        {(["left", "right"] as const).map((side, index) => (
          <div key={side}>
            <h4>
              {index ? "Draft / snapshot" : "Baseline"}
              {(index ? after : before) === undefined && (
                <small> · File not present</small>
              )}
            </h4>
            <div
              className="planner-diff-source"
              ref={(node) => {
                panes.current[index] = node;
              }}
              onScroll={(event) => {
                const peer = panes.current[1 - index];
                if (peer && peer.scrollTop !== event.currentTarget.scrollTop)
                  peer.scrollTop = event.currentTarget.scrollTop;
              }}
            >
              {diff.rows.map((row, i) => {
                const entry = row[side];
                return (
                  <div
                    key={i}
                    className={
                      entry
                        ? entry.kind === "unchanged"
                          ? ""
                          : entry.kind
                        : "diff-gap"
                    }
                    data-line={entry?.number}
                  >
                    <span>{entry?.number ?? ""}</span>
                    <span
                      className="diff-sign"
                      aria-label={
                        entry?.kind === "added"
                          ? "Added line"
                          : entry?.kind === "removed"
                            ? "Removed line"
                            : undefined
                      }
                    >
                      {entry?.kind === "added"
                        ? "+"
                        : entry?.kind === "removed"
                          ? "−"
                          : " "}
                    </span>
                    <code>
                      {entry?.parts
                        ? entry.parts.map((part, j) =>
                            part.changed ? (
                              <mark key={j}>{part.value}</mark>
                            ) : (
                              <React.Fragment key={j}>
                                {part.value}
                              </React.Fragment>
                            ),
                          )
                        : entry?.text || " "}
                      {entry?.noNewline && (
                        <em className="diff-eof"> No newline at end of file</em>
                      )}
                    </code>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
