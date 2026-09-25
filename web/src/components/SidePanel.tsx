import { useEffect, type ReactNode } from "react";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import { GlassIconButton } from "./Glass";

// Desktop modal: an inset panel on the right over a dimmed page, with the
// close button in the page's top-left corner (where the account button sits)
export function SidePanel({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave Escape to any dialog opened from the panel
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { ref, backdropRef, handlers } = useDragToDismiss<HTMLElement>(onClose);

  return createPortal(
    <>
      <div ref={backdropRef} className="fixed inset-0 z-[55] bg-black/35 animate-in fade-in duration-200" onClick={onClose} aria-hidden />
      <GlassIconButton onClick={onClose} aria-label="Close" className="fixed left-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] z-[70] animate-in fade-in duration-200">
        <CloseIcon className="size-5" />
      </GlassIconButton>
      {/* The transform keeps the pages' fixed elements (session sheet, buttons) inside the panel */}
      {/* Drag right to dismiss */}
      <aside
        ref={ref}
        {...handlers}
        aria-label={label}
        className="fixed bottom-5 right-5 top-5 z-[60] flex w-[440px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)] [transform:translateZ(0)] animate-in fade-in slide-in-from-right-8 duration-200"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-gutter)] pb-28">{children}</div>
      </aside>
    </>,
    document.body
  );
}
