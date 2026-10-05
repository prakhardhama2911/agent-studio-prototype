import React, {
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { GripVertical } from "lucide-react";

export function OverviewSplit({
  children,
}: {
  children: [ReactNode, ReactNode];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(32);
  const [dragging, setDragging] = useState(false);
  const clamp = (value: number) => Math.max(25, Math.min(50, value));
  return (
    <div
      ref={container}
      className={`overview-split${dragging ? " is-resizing" : ""}`}
      style={
        {
          "--overview-left": `${leftWidth}fr`,
          "--overview-right": `${100 - leftWidth}fr`,
        } as CSSProperties
      }
    >
      {children[0]}
      <div
        className="overview-resize-handle"
        role="separator"
        aria-label="Resize overview panels"
        aria-orientation="vertical"
        aria-valuemin={25}
        aria-valuemax={50}
        aria-valuenow={Math.round(leftWidth)}
        aria-valuetext={`Agent details ${Math.round(leftWidth)} percent; primary instructions ${Math.round(100 - leftWidth)} percent`}
        aria-controls="overview-details"
        tabIndex={0}
        title="Drag to resize panels, or use the left and right arrow keys"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (
            !event.currentTarget.hasPointerCapture(event.pointerId) ||
            !container.current
          )
            return;
          const rect = container.current.getBoundingClientRect();
          if (rect.width > 16)
            setLeftWidth(
              clamp(
                ((event.clientX - rect.left - 8) / (rect.width - 16)) * 100,
              ),
            );
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onLostPointerCapture={() => setDragging(false)}
        onDoubleClick={() => setLeftWidth(32)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          setLeftWidth((value) =>
            event.key === "Home"
              ? 25
              : event.key === "End"
                ? 50
                : clamp(value + (event.key === "ArrowLeft" ? -2 : 2)),
          );
        }}
      >
        <GripVertical size={16} />
      </div>
      {children[1]}
    </div>
  );
}
