import React, { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

export function ModelSharingInfo({
  name,
  agents,
  packageScoped = false,
}: {
  name: string;
  agents: string[];
  packageScoped?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  return (
    <span className="model-sharing-info" ref={root}>
      <button
        type="button"
        className="model-info-button"
        aria-label={`Show agents using ${name}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Info size={14} />
      </button>
      {open && (
        <span className="model-sharing-popover" id={id} role="tooltip">
          <strong>{agents.length > 1 ? "Shared model" : "Model usage"}</strong>
          <span>
            {agents.length > 1
              ? "This model is shared by:"
              : "This model is used by:"}
          </span>
          {packageScoped && (
            <span>Settings changes apply only to this agent’s package.</span>
          )}
          <span className="model-sharing-agents">
            {agents.map((agent) => (
              <span key={agent}>{agent}</span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
