import { diffLines, diffWordsWithSpace } from "diff";
export type ReviewLine = {
  number: number;
  text: string;
  kind: "unchanged" | "added" | "removed";
  noNewline: boolean;
  parts?: { value: string; changed: boolean }[];
};
export type ReviewRow = { left: ReviewLine | null; right: ReviewLine | null };
const normalize = (text: string) => text.replace(/\r\n/g, "\n");
const tokens = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
export function buildReviewDiff(before?: string, after?: string) {
  const oldText = normalize(before ?? ""),
    newText = normalize(after ?? "");
  const chunks = diffLines(oldText, newText, { timeout: 1000 });
  if (!chunks)
    return {
      rows: [] as ReviewRow[],
      added: 0,
      removed: 0,
      unavailable: true,
      lineEndingsOnly: false,
    };
  const rows: ReviewRow[] = [];
  let leftNumber = 1,
    rightNumber = 1,
    added = 0,
    removed = 0;
  const line = (
    raw: string,
    number: number,
    kind: ReviewLine["kind"],
  ): ReviewLine => ({
    number,
    kind,
    text: raw.endsWith("\n") ? raw.slice(0, -1) : raw,
    noNewline: !raw.endsWith("\n"),
  });
  for (let i = 0; i < chunks.length;) {
    const chunk = chunks[i];
    if (!chunk.added && !chunk.removed) {
      for (const token of tokens(chunk.value))
        rows.push({
          left: line(token, leftNumber++, "unchanged"),
          right: line(token, rightNumber++, "unchanged"),
        });
      i++;
      continue;
    }
    const deleted: string[] = [],
      inserted: string[] = [];
    while (i < chunks.length && (chunks[i].added || chunks[i].removed)) {
      const c = chunks[i++];
      (c.added ? inserted : deleted).push(...tokens(c.value));
    }
    added += inserted.length;
    removed += deleted.length;
    for (let j = 0; j < Math.max(deleted.length, inserted.length); j++) {
      const left =
        j < deleted.length ? line(deleted[j], leftNumber++, "removed") : null;
      const right =
        j < inserted.length ? line(inserted[j], rightNumber++, "added") : null;
      if (
        left &&
        right &&
        left.text !== right.text &&
        left.text.length + right.text.length < 20000
      ) {
        const parts = diffWordsWithSpace(left.text, right.text, {
          timeout: 25,
        });
        if (parts) {
          left.parts = parts
            .filter((p) => !p.added)
            .map((p) => ({ value: p.value, changed: !!p.removed }));
          right.parts = parts
            .filter((p) => !p.removed)
            .map((p) => ({ value: p.value, changed: !!p.added }));
        }
      }
      rows.push({ left, right });
    }
  }
  return {
    rows,
    added,
    removed,
    unavailable: false,
    lineEndingsOnly: before !== after && oldText === newText,
  };
}
