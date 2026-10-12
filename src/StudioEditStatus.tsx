import React from "react";
import { LockKeyhole, Pencil, UnlockKeyhole } from "lucide-react";
import { Button } from "./ui";

export function StudioEditStatus({
  owner,
  mine,
  pending,
  ready,
  startedAt,
  onEnter,
  onExit,
}: {
  owner?: string;
  mine: boolean;
  pending: boolean;
  ready: boolean;
  startedAt?: string;
  onEnter: () => void;
  onExit: () => void;
}) {
  return (
    <section
      className={`studio-edit-status ${owner ? "is-locked" : ""}`}
      aria-label="Studio edit status"
    >
      <span className="studio-lock-icon">
        {owner ? <LockKeyhole size={21} /> : <UnlockKeyhole size={21} />}
      </span>
      <div className="studio-lock-copy" role="status">
        <strong>
          {owner
            ? `Agent Studio locked by ${owner}${mine ? " (you)" : ""}`
            : "Agent Studio is in view mode"}
        </strong>
        <p>
          {mine
            ? "Only you can edit. Saved changes remain private until you exit edit mode."
            : owner
              ? "You can browse the latest development version. Editing is unavailable until the owner exits edit mode."
              : "Browse the latest development version. Enter edit mode to make changes."}
        </p>
        {startedAt && (
          <small>Locked since {new Date(startedAt).toLocaleString()}</small>
        )}
      </div>
      {mine ? (
        <Button disabled={pending} onClick={onExit}>
          <UnlockKeyhole size={16} />
          Exit edit mode
        </Button>
      ) : (
        <Button
          primary
          disabled={!!owner || pending || !ready}
          onClick={onEnter}
        >
          <Pencil size={16} />
          {owner ? "Editing locked" : "Edit mode"}
        </Button>
      )}
    </section>
  );
}
