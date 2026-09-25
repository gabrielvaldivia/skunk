import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

// Pointer targets that keep their own behaviour instead of starting a drag
const INTERACTIVE = "input, textarea, select, button, a, label, [role='combobox'], [role='option'], [role='slider']";

/**
 * Drag a right-side panel to the right to dismiss it. Moves the element
 * directly (no re-renders) and optionally fades a backdrop along with it.
 * A drag past a third of the panel, or a flick, dismisses; otherwise it
 * springs back.
 */
export function useDragToDismiss<T extends HTMLElement>(onDismiss: () => void) {
  const panel = useRef<T>(null);
  // Attach to a backdrop to fade it with the drag
  const backdrop = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    state: "idle" | "pending" | "dragging";
    id: number;
    x: number;
    y: number;
    samples: { t: number; x: number }[];
  }>({ state: "idle", id: 0, x: 0, y: 0, samples: [] });

  const setOffset = useCallback((x: number, animate: boolean) => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = animate ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
    // Keep translateZ so the panel stays the containing block for its fixed children
    el.style.transform = `translateX(${x}px) translateZ(0)`;
    if (backdrop.current) {
      const progress = Math.min(1, x / el.offsetWidth);
      backdrop.current.style.transition = animate ? "opacity 220ms ease" : "none";
      backdrop.current.style.opacity = String(1 - progress);
    }
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<T>) => {
    if (e.button !== 0 || (e.target as Element).closest(INTERACTIVE)) return;
    drag.current = { state: "pending", id: e.pointerId, x: e.clientX, y: e.clientY, samples: [{ t: performance.now(), x: e.clientX }] };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<T>) => {
    const d = drag.current;
    if (d.state === "idle" || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.state === "pending") {
      // Mostly vertical: that's a scroll, not a dismiss
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        d.state = "idle";
        return;
      }
      if (dx < 8 || Math.abs(dx) < Math.abs(dy)) return;
      d.state = "dragging";
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not an active pointer; dragging still works without capture
      }
      document.body.style.userSelect = "none";
    }
    const now = performance.now();
    d.samples.push({ t: now, x: e.clientX });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
    setOffset(Math.max(0, dx), false);
  }, [setOffset]);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<T>) => {
      const d = drag.current;
      const wasDragging = d.state === "dragging";
      d.state = "idle";
      if (!wasDragging) return;
      document.body.style.userSelect = "";
      const el = panel.current;
      const dx = Math.max(0, e.clientX - d.x);
      const first = d.samples[0];
      const velocity = (e.clientX - first.x) / Math.max(1, performance.now() - first.t); // px per ms
      if (el && (dx > el.offsetWidth / 3 || velocity > 0.5)) {
        setOffset(el.offsetWidth + 40, true);
        setTimeout(onDismiss, 200);
      } else {
        setOffset(0, true);
      }
    },
    [onDismiss, setOffset]
  );

  return { ref: panel, backdropRef: backdrop, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}
