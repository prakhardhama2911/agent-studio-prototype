import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

// Presentation-only onboarding. Removing this component does not affect drafts.
export const PLANNER_TOUR_ENABLED = true;
export const PLANNER_TOUR_KEY = "alchemy-studio:planner-tour:v1";
const steps = [
  {
    target: "development",
    title: "Start with the active version",
    text: "Active development is the configuration currently in use. Viewing it does not change anything. Your edits will live in a separate draft.",
  },
  {
    target: "draft-action",
    title: "Create your own draft",
    text: "A draft copies the active package and remembers its baseline. In this tour, the draft is temporary. Leaving the tour restores your previous view and preserves any real draft.",
  },
  {
    target: "artefact-tabs",
    title: "Choose what to update",
    text: "Use these tabs for skills, prompts, worker definitions, and models. Worker definitions belong to the Planner package. All edits stay inside your draft.",
  },
  {
    target: "editor",
    title: "Edit your package",
    text: "Select a file in the explorer, then edit its content. You can also add or import files and folders. Download a ZIP whenever you need a copy.",
  },
  {
    target: "draft-footer",
    title: "Save now or continue later",
    text: "Changes autosave after a short pause. Save draft saves immediately. Exit draft keeps saved work for later; Discard draft deletes your draft after confirmation.",
  },
  {
    target: "review",
    title: "Review what changed",
    text: "Review changes compares your draft with its original baseline. Added, changed, and deleted artefacts are shown together. Reviewing is optional, and does not publish anything.",
  },
  {
    target: "draft-action",
    title: "Publish when you are ready",
    text: "Publish changes validates your draft, records an immutable version, and makes it active in development. If someone has published since you started, update your draft against latest first. This tour will not publish for you.",
  },
  {
    target: "publications",
    title: "Find your version history",
    text: "Publications keeps the active version and earlier snapshots for inspection. You are ready to work: edit, review, then publish when you choose.",
  },
];
export function PlannerTour({
  isDraft,
  hasDraft,
  startDraft,
  onClose,
}: {
  isDraft: boolean;
  hasDraft: boolean;
  startDraft: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0),
    [error, setError] = useState("");
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const dialog = useRef<HTMLDialogElement>(null),
    nextButton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const [cardHeight, setCardHeight] = useState(310);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (card.current)
        setCardHeight(card.current.getBoundingClientRect().height);
    });
    if (card.current) observer.observe(card.current);
    return () => observer.disconnect();
  }, []);
  const item = steps[step];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      `.planner-dialog [data-planner-tour="${item.target}"]`,
    );
    target?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (!target) {
        setRect(null);
        return;
      }
      const r = target.getBoundingClientRect();
      const top = Math.max(8, r.top),
        left = Math.max(8, r.left);
      setRect({
        top,
        left,
        width: Math.max(0, Math.min(r.right, window.innerWidth - 8) - left),
        height: Math.max(0, Math.min(r.bottom, window.innerHeight - 8) - top),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    if (target) observer.observe(target);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    nextButton.current?.focus({ preventScroll: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, isDraft, item.target]);
  const mobile = viewport.width < 600,
    width = Math.min(360, viewport.width - 32);
  const left = mobile
    ? 16
    : Math.max(
        16,
        Math.min(
          rect?.left ?? (viewport.width - width) / 2,
          viewport.width - width - 16,
        ),
      );
  const below = rect
    ? rect.top + rect.height + 16
    : (viewport.height - cardHeight) / 2;
  const top = mobile
    ? Math.max(16, viewport.height - cardHeight - 16)
    : Math.max(
        16,
        Math.min(
          below + cardHeight < viewport.height
            ? below
            : (rect?.top ?? cardHeight) - cardHeight - 16,
          viewport.height - cardHeight - 16,
        ),
      );
  const create = step === 1 && !isDraft;
  const advance = () => {
    try {
      if (create) startDraft();
      setError("");
      if (step === steps.length - 1) onClose();
      else setStep(step + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="planner-tour"
      aria-labelledby="planner-tour-title"
      aria-describedby="planner-tour-description"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      {rect && rect.width > 0 && rect.height > 0 ? (
        <div
          className="planner-tour-spotlight"
          aria-hidden="true"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : (
        <div className="planner-tour-shade" />
      )}
      <section className="planner-tour-card" style={{ top, left, width }}>
        <div className="planner-tour-top">
          <span>
            DRAFT GUIDE · {step + 1} OF {steps.length}
          </span>
          <button aria-label="Close draft guide" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="planner-tour-progress" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={i <= step ? "complete" : ""} />
          ))}
        </div>
        <div aria-live="polite">
          <h3 id="planner-tour-title">
            {step === 1 && hasDraft ? "Continue your saved draft" : item.title}
          </h3>
          <p id="planner-tour-description">{item.text}</p>
        </div>
        {error && (
          <p className="planner-tour-error" role="alert">
            {error}
          </p>
        )}
        <div className="planner-tour-actions">
          <button className="planner-tour-skip" onClick={onClose}>
            Skip tour
          </button>
          <div>
            <button
              className="button"
              disabled={step === 0}
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
              aria-label="Previous tour step"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              ref={nextButton}
              className="button primary"
              onClick={advance}
            >
              {step === steps.length - 1 ? (
                <>
                  <Check size={14} />
                  Finish
                </>
              ) : create ? (
                hasDraft ? (
                  "Resume draft & continue"
                ) : (
                  "Create draft & continue"
                )
              ) : (
                <>
                  Next
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </dialog>
  );
}
