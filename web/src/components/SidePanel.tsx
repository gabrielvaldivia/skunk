import { useEffect, type ReactNode } from "react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { createPortal } from "react-dom";

// Desktop modal: an inset panel over a dimmed page. Its pages' nav bars carry
// the close button, in the panel's top-right corner
export function SidePanel({
  label,
  side = "right",
  onClose,
  children,
}: {
  label: string;
  side?: "left" | "right";
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave Escape to any dialog opened from the panel
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { ref, backdropRef, handlers } = useDragToDismiss<HTMLElement>(onClose, side);

  return createPortal(
    <>
      <div ref={backdropRef} className="fixed inset-0 z-[55] bg-black/35 animate-in fade-in duration-200" onClick={onClose} aria-hidden />
      {/* The transform keeps the pages' fixed elements (session sheet, buttons) inside the panel */}
      {/* Drag toward the panel's edge to dismiss */}
      <aside
        ref={ref}
        {...handlers}
        aria-label={label}
        className={`fixed bottom-5 top-5 ${side === "left" ? "left-5" : "right-5"} z-[60] flex w-[440px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)] [transform:translateZ(0)] animate-in fade-in ${side === "left" ? "slide-in-from-left-8" : "slide-in-from-right-8"} duration-200`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-gutter)] pb-28">{children}</div>
      </aside>
    </>,
    document.body
  );
}
