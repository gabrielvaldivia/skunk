import { useCallback, type ComponentProps } from "react";
import { Link, useNavigate } from "react-router-dom";
import { entryFromPath, usePanelFrame } from "../context/PanelContext";

// A Link that, inside a desktop panel, opens its page in the panel instead of
// navigating away from the shelf
export function AppLink({ to, onClick, ...props }: ComponentProps<typeof Link> & { to: string }) {
  const frame = usePanelFrame();
  return (
    <Link
      to={to}
      onClick={(e) => {
        onClick?.(e);
        const entry = frame && entryFromPath(to);
        // Let modified clicks (new tab) through
        if (entry && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          frame.open(entry);
        }
      }}
      {...props}
    />
  );
}

/** navigate(), but opening in the panel when there is one */
export function useAppNavigate() {
  const navigate = useNavigate();
  const frame = usePanelFrame();
  return useCallback(
    (to: string) => {
      const entry = frame && entryFromPath(to);
      if (entry) frame.open(entry);
      else navigate(to);
    },
    [frame, navigate]
  );
}
