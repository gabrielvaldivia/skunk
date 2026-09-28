import { isValidElement, useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { usePanelFrame } from "../context/PanelContext";
import { BackIcon, CloseIcon } from "./icons";
import { Button } from "@/components/ui/button";

interface NavBarProps {
  title?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  /** Leave out the back button, when the page around it provides one */
  hideBack?: boolean;
  /**
   * A close (×) pinned to the screen's top-left corner, where the account
   * button sits, for pages opened from it
   */
  closeInCorner?: boolean;
  /** Pin the action to the screen's top-right corner (e.g. over a full-screen hero) */
  actionInCorner?: boolean;
  /**
   * In a desktop panel: a name shown beside the close/back button once
   * `scrollAnchor` (the page's own heading) scrolls up under the bar
   */
  scrollTitle?: string;
  scrollAnchor?: RefObject<HTMLElement | null>;
}

// Sticky compact header for detail pages: back | centered title | action
export function NavBar({
  title,
  action,
  onBack,
  hideBack: hideBackProp,
  closeInCorner: closeInCornerProp,
  actionInCorner,
  scrollTitle,
  scrollAnchor,
}: NavBarProps) {
  const navigate = useNavigate();
  // Inside a desktop panel, the first page has close top-left; later pages
  // have back there instead, walking the panel's own stack
  const frame = usePanelFrame();
  const hideBack = frame ? !frame.canGoBack : hideBackProp;
  const closeInCorner = !frame && closeInCornerProp;
  const showsScrollTitle = !!frame && !!scrollTitle && !!scrollAnchor;
  const [pastHeading, setPastHeading] = useState(false);
  useEffect(() => {
    const el = scrollAnchor?.current;
    if (!showsScrollTitle || !el) return;
    // The panel sits 1.25rem down and its bar is about 4rem tall; the heading
    // counts as gone once it's under the bar
    const observer = new IntersectionObserver(([entry]) => setPastHeading(!entry.isIntersecting && entry.boundingClientRect.top < 100), {
      rootMargin: "-84px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showsScrollTitle, scrollAnchor]);
  // Opened directly (no in-app history to go back to): fall back to the home tab
  const goBack =
    (frame?.back ?? onBack) || (() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/")));
  const cornerAction =
    actionInCorner &&
    action &&
    createPortal(
      <div className="fixed right-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] z-[70] flex gap-2 [&>button]:size-12 [&>button]:rounded-full [&>button]:border [&>button]:border-border/60 [&>button]:bg-background/75 [&>button]:shadow-[0_8px_32px_-8px_rgb(0_0_0/0.25)] [&>button]:backdrop-blur-xl">
        {action}
      </div>,
      document.body
    );

  // Nothing left in the bar itself (e.g. a full-screen game on phones): skip
  // it rather than leave an empty row
  if (hideBack && !title && (actionInCorner || !action) && !closeInCorner && !frame) return <>{cornerAction}</>;

  return (
    <div className={frame ? `page-header nav-bar nav-bar-panel${isValidElement(title) ? " nav-bar-panel-wide" : ""}` : hideBack ? "page-header nav-bar nav-bar-no-back" : "page-header nav-bar"}>
      {frame ? (
        <div className="flex min-w-0 items-center gap-3">
          {hideBack ? (
            <Button variant="secondary" size="icon" onClick={frame.close} aria-label="Close">
              <CloseIcon className="!size-5" />
            </Button>
          ) : (
            <Button variant="secondary" size="icon" onClick={goBack} aria-label="Go back">
              <BackIcon className="!size-5" />
            </Button>
          )}
          {showsScrollTitle && (
            <span
              className={`truncate text-base font-semibold transition-opacity duration-200 ${pastHeading ? "opacity-100" : "opacity-0"}`}
              aria-hidden={!pastHeading}
            >
              {scrollTitle}
            </span>
          )}
        </div>
      ) : hideBack ? null : closeInCorner ? (
        // Keeps the title centred under the corner close button
        <span className="size-10 shrink-0" aria-hidden />
      ) : (
        <Button
          variant="secondary"
          size="icon"
          onClick={goBack}
          aria-label="Go back"
        >
          <BackIcon className="!size-5" />
        </Button>
      )}
      <h1 className="nav-bar-title">{title}</h1>
      <div className="nav-bar-action gap-2">{!actionInCorner && action}</div>
      {cornerAction}
      {/* Portalled: the header's backdrop blur would otherwise pin it to the header */}
      {closeInCorner &&
        createPortal(
          <button
            type="button"
            onClick={goBack}
            aria-label="Close"
            className="fixed left-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] z-50 flex size-12 items-center justify-center rounded-full border border-border/60 bg-background/75 text-foreground shadow-[0_8px_32px_-8px_rgb(0_0_0/0.25)] backdrop-blur-xl backdrop-saturate-150 active:scale-95"
          >
            <CloseIcon className="size-5" />
          </button>,
          document.body
        )}
    </div>
  );
}
