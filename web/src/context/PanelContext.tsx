import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useMediaQuery } from "@/hooks/use-media-query";

// Desktop dialog system: pages that would otherwise navigate away from the
// shelf (Activity, Players, a player, a game, your account) open in one side
// panel instead, with their own back stack. Phones keep full pages.

export type PanelEntry =
  | { type: "activity" }
  | { type: "players" }
  | { type: "player"; id: string }
  | { type: "game"; id: string }
  | { type: "profile" };

/** The panel entry for an in-app path, if that page can live in the panel */
export function entryFromPath(path: string): PanelEntry | null {
  const [, first, id, extra] = path.split("?")[0].split("/");
  if (extra) return null;
  if (first === "activity" && !id) return { type: "activity" };
  if (first === "profile" && !id) return { type: "profile" };
  if (first === "players") return id ? { type: "player", id } : { type: "players" };
  if (first === "games" && id && id !== "list" && id !== "shelf") return { type: "game", id };
  return null;
}

type PanelApi = {
  stack: PanelEntry[];
  /** Open a fresh panel (replacing whatever is open) */
  open: (entry: PanelEntry) => void;
  push: (entry: PanelEntry) => void;
  back: () => void;
  close: () => void;
};

const PanelContext = createContext<PanelApi | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [stack, setStack] = useState<PanelEntry[]>([]);
  const location = useLocation();

  const open = useCallback((entry: PanelEntry) => setStack([entry]), []);
  const push = useCallback((entry: PanelEntry) => setStack((s) => [...s, entry]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);

  // Leaving the page (e.g. starting a session) closes the panel
  const [path, setPath] = useState(location.pathname);
  if (path !== location.pathname) {
    setPath(location.pathname);
    if (stack.length) setStack([]);
  }

  // Screen chrome (account button) steps aside, as for a selected game
  const isOpen = isDesktop && stack.length > 0;
  useEffect(() => {
    document.documentElement.classList.toggle("panel-open", isOpen);
    return () => document.documentElement.classList.remove("panel-open");
  }, [isOpen]);

  const api = useMemo(() => ({ stack, open, push, back, close }), [stack, open, push, back, close]);
  return <PanelContext.Provider value={isDesktop ? api : null}>{children}</PanelContext.Provider>;
}

/** The panel system, or null on phones (navigate to pages instead) */
export function usePanel() {
  return useContext(PanelContext);
}

// Set by whatever hosts a page in a panel: tells NavBar how to go back, and
// links where to open
type PanelFrame = { canGoBack: boolean; back: () => void; open: (entry: PanelEntry) => void };

const PanelFrameContext = createContext<PanelFrame | null>(null);
export const PanelFrameProvider = PanelFrameContext.Provider;

export function usePanelFrame() {
  return useContext(PanelFrameContext);
}
