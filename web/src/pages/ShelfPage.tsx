import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GamesHeader } from "../components/GamesHeader";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { useDragToDismiss } from "../hooks/useDragToDismiss";
import { useKeyboardInsets } from "../hooks/useKeyboardInsets";
import { useGameScope, useMyGameIds } from "../hooks/useGameScope";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { AddGameForm } from "../components/AddGameForm";
import { PanelFrameProvider, usePanel, type PanelEntry } from "../context/PanelContext";
import { useGames } from "../hooks/useGames";
import { useMediaQuery } from "@/hooks/use-media-query";
import { GameDetailPage } from "./GameDetailPage";
import { CardGamePicker } from "../components/CardGamePicker";
import { CloseIcon } from "../components/icons";
import { CARD_DECK_ID, foldCardGames } from "@/lib/cardDeck";

// Width of the desktop detail panel; the selected box centres in the space left of it
const PANEL_WIDTH = 440;
const PANEL_MARGIN = 20;
// Phones: the game's details slide up in a sheet from here down, and the box
// floats large in the space above it, as the page's hero
const SHEET_TOP = 0.46;

function useViewportHeight() {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return h;
}

// three.js is ~270 KB gzipped, so it only loads when someone opens the shelf
const GameShelf = lazy(() => import("../components/shelf/GameShelf").then((m) => ({ default: m.GameShelf })));

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function ShelfPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { games, isLoading: gamesLoading, addGame } = useGames();
  const [showAddForm, setShowAddForm] = useState(false);
  const panel = usePanel();
  const { isAuthenticated } = useAuth();
  const [scope, setScope] = useGameScope();
  const { ids: myIds, isLoading: myLoading } = useMyGameIds(games);
  const mine = scope === "mine";
  // Signed out, My Games has nothing to show but a sign-up prompt
  const needsSignIn = mine && !isAuthenticated;
  // Wait for match history before laying out My Games, so it doesn't reshuffle
  const isLoading = gamesLoading || (mine && isAuthenticated && myLoading);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dark = useIsDark();
  const [query, setQuery] = useSearchQuery();
  const sorted = useMemo(() => [...games].sort((a, b) => a.title.localeCompare(b.title)), [games]);
  // Card games fold into a single deck on the shelf
  // Searching always covers every game, whichever tab you're on
  const searching = query.trim() !== "";
  const scoped = useMemo(
    () => (searching ? sorted : needsSignIn ? [] : mine ? sorted.filter((g) => myIds.has(g.id)) : sorted),
    [sorted, mine, myIds, needsSignIn, searching]
  );
  const { shelf: shown, inDeck } = useMemo(() => foldCardGames(scoped, query), [scoped, query]);
  const selected = shown.find((g) => g.id === selectedId);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const viewportHeight = useViewportHeight();
  // iOS pans the page up when the search field focuses; follow the visible area
  useKeyboardInsets();
  const panelOpen = !!selected;
  // Where the selected box floats: left of the desktop panel, or above the
  // phone sheet (clear of the close button)
  const focus = !selected
    ? undefined
    : isDesktop
      ? { top: 0, right: PANEL_WIDTH + PANEL_MARGIN, bottom: 0, margin: 1.6 }
      : { top: 72, right: 0, bottom: viewportHeight * (1 - SHEET_TOP) + 12, margin: 1.75, solidBackdrop: true };
  const select = (id: string | null) => setSelectedId(id);

  // Fade the tab bar and account button while a game is showing
  useEffect(() => {
    document.documentElement.classList.toggle("shelf-focus", !!selected);
    return () => document.documentElement.classList.remove("shelf-focus");
  }, [selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Let an open dialog (e.g. Edit Game in the panel) handle its own Escape
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A player or game linked from the selected game's panel opens in the
  // desktop panel system, letting go of the box on the shelf
  const detailFrame = panel
    ? {
        canGoBack: false,
        back: () => select(null),
        open: (entry: PanelEntry) => {
          select(null);
          panel.open(entry);
        },
      }
    : null;

  // Desktop: drag the game's panel to the right to put the game back
  const { ref: detailRef, handlers: detailDrag } = useDragToDismiss<HTMLElement>(() => select(null));

  const detailPanel = selected && (
    // The transform makes this the containing block for the detail page's
    // fixed elements (Start Session button, session sheet), keeping them in the panel
    <aside
      ref={detailRef}
      {...(isDesktop ? detailDrag : {})}
      aria-label={`${selected.title} details`}
      className={
        isDesktop
          ? "absolute z-20 flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-background shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)] [transform:translateZ(0)] animate-in fade-in slide-in-from-right-8 duration-200"
          // Full screen, see-through at the top so the 3D box shows as the hero
          : "pointer-events-none absolute inset-0 z-20 flex flex-col [transform:translateZ(0)]"
      }
      style={
        isDesktop
          ? { width: PANEL_WIDTH, top: PANEL_MARGIN, right: PANEL_MARGIN, bottom: PANEL_MARGIN }
          : undefined
      }
    >
      <div
        className={
          isDesktop
            ? "min-h-0 flex-1 overflow-y-auto px-[var(--page-gutter)] pb-28"
            : "min-h-0 flex-1 overflow-y-auto"
        }
      >
        {/* Phones: taps on the hero area reach the box (drag to throw it back);
            the details scroll up over it */}
        {!isDesktop && <div aria-hidden style={{ height: `${SHEET_TOP * 100}vh` }} />}
        <div
          className={
            isDesktop
              ? undefined
              // Fades in with the shelf fading to the page colour behind it (no
              // slide), so the whole screen turns into the page at once
              : "pointer-events-auto min-h-[calc(100vh-var(--hero))] bg-background px-[var(--page-gutter)] pb-28 animate-in fade-in duration-200 ease-out"
          }
          style={isDesktop ? undefined : ({ "--hero": `${SHEET_TOP * 100}vh` } as React.CSSProperties)}
        >
        <PanelFrameProvider value={detailFrame}>
          {selected.id === CARD_DECK_ID ? (
            <CardGamePicker games={inDeck} onClose={() => select(null)} />
          ) : (
            <GameDetailPage key={selected.id} gameId={selected.id} onClose={() => select(null)} />
          )}
        </PanelFrameProvider>
        </div>
      </div>
    </aside>
  );

  return (
    // Shifted down by however far iOS panned for the keyboard, so the shelf and
    // header stay in view (the header is fixed inside, so it moves with this)
    <div className="fixed inset-0 bg-background [transform:translateY(var(--vv-top,0px))]">
      <GamesHeader
        scope={scope}
        onScopeChange={(s) => {
          setScope(s);
          select(null);
        }}
        onAdd={() =>
          isAuthenticated ? setShowAddForm(true) : navigate("/signin", { state: { from: location } })
        }
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          setSelectedId(null);
        }}
        hidden={!!selected}
        onActivity={panel ? () => panel.open({ type: "activity" }) : undefined}
      />

      {isLoading ? (
        <div className="loading">Loading games...</div>
      ) : (
        <Suspense fallback={<div className="loading">Building shelf...</div>}>
          <GameShelf
            games={shown}
            selectedId={selectedId}
            onSelect={select}
            dark={dark}
            resetKey={query}
            focus={focus}
          />
        </Suspense>
      )}

      {!isLoading && shown.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-[var(--page-gutter)]">
          {searching ? (
            <p className="text-sm font-medium text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
              No games match "{query.trim()}"
            </p>
          ) : needsSignIn ? (
            <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-3xl border border-border/60 bg-background/85 p-6 text-center shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)] backdrop-blur-xl">
              <p className="text-lg font-semibold">Your shelf starts here</p>
              <p className="text-sm text-muted-foreground">
                Sign up to fill your shelf with every game you play or add.
              </p>
              <Button className="mt-1 w-full rounded-full" onClick={() => navigate("/signin", { state: { from: location } })}>
                Sign up
              </Button>
            </div>
          ) : mine ? (
            <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-3xl border border-border/60 bg-background/85 p-6 text-center shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)] backdrop-blur-xl">
              <p className="text-lg font-semibold">No games yet</p>
              <p className="text-sm text-muted-foreground">Games you play or add will show up here.</p>
            </div>
          ) : null}
        </div>
      )}

      {selected &&
        // Page-level close in the corner the account button just vacated; portalled
        // so it stays above the phone's full-screen card game sheet
        createPortal(
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Close"
            className="fixed left-[var(--page-gutter)] top-[calc(var(--safe-top)+0.75rem)] z-[70] flex size-12 items-center justify-center rounded-full border border-border/60 bg-background/75 text-foreground shadow-[0_8px_32px_-8px_rgb(0_0_0/0.25)] backdrop-blur-xl backdrop-saturate-150 animate-in fade-in duration-200 active:scale-95"
          >
            <CloseIcon className="size-5" />
          </button>,
          document.body
        )}

      {panelOpen && detailPanel}

      {isAuthenticated && (
        <AddGameForm
          open={showAddForm}
          onOpenChange={setShowAddForm}
          onSubmit={async (game) => {
            await addGame(game);
          }}
        />
      )}

      {/* The canvas isn't readable by screen readers, so mirror it as a list */}
      <ul className="sr-only">
        {sorted.map((g) => (
          <li key={g.id}>
            <Link to={`/games/${g.id}`}>{g.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
