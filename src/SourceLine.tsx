import React from "react";

export function SourceLine({
  line,
  frontmatter,
}: {
  line: string;
  frontmatter: boolean;
}) {
  if (line === "---") return <span className="registry-delimiter">{line}</span>;
  if (frontmatter) {
    if (/^\s*#/.test(line))
      return <span className="registry-comment">{line}</span>;
    const pair = line.match(/^(\s*(?:-\s+)?)([\w-]+)(:)(.*)$/);
    if (pair)
      return (
        <>
          {pair[1]}
          <span className="registry-key">{pair[2]}</span>
          <span className="registry-punctuation">{pair[3]}</span>
          <span className="registry-value">{pair[4]}</span>
        </>
      );
    if (/^\s*-/.test(line))
      return <span className="registry-value">{line}</span>;
  }
  if (/^#{1,6}\s/.test(line))
    return <span className="registry-heading">{line}</span>;
  return <>{line || " "}</>;
}
