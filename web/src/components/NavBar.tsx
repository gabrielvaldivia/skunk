import type { ReactNode } from "react";
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
}

// Sticky compact header for detail pages: back | centered title | action
export function NavBar({ title, action, onBack, hideBack: hideBackProp, closeInCorner: closeInCornerProp, actionInCorner }: NavBarProps) {
  const navigate = useNavigate();
  // Inside a desktop panel, back walks the panel's own stack; the panel
  // provides the close button, and its first page has no back
  const frame = usePanelFrame();
  const hideBack = frame ? !frame.canGoBack : hideBackProp;
  const closeInCorner = !frame && closeInCornerProp;
  // Opened directly (no in-app history to go back to): fall back to the home tab
  const goBack =
    (frame?.back ?? onBack) || (() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/")));
  const cornerAction =
    actionInCorner &&
    action &&
    createPortal(
      <div className="fixed right-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] z-[70] [&>button]:size-12 [&>button]:liquid-glass [&>button]:rounded-full">
        {action}
      </div>,
      document.body
    );

  // Nothing left in the bar itself (e.g. a full-screen game on phones): skip
  // it rather than leave an empty row
  if (hideBack && !title && (actionInCorner || !action) && !closeInCorner) return <>{cornerAction}</>;

  return (
    <div className={hideBack ? "page-header nav-bar nav-bar-no-back" : "page-header nav-bar"}>
      {hideBack ? null : closeInCorner ? (
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
      <div className="nav-bar-action">{!actionInCorner && action}</div>
      {cornerAction}
      {/* Portalled: the header's backdrop blur would otherwise pin it to the header */}
      {closeInCorner &&
        createPortal(
          <button
            type="button"
            onClick={goBack}
            aria-label="Close"
            className="fixed left-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] z-50 flex size-12 items-center justify-center rounded-full liquid-glass active:scale-95"
          >
            <CloseIcon className="size-5" />
          </button>,
          document.body
        )}
    </div>
  );
}
