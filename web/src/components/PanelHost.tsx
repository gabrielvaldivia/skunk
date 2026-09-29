import { lazy, Suspense, useMemo } from "react";
import { PanelFrameProvider, usePanel, type PanelEntry } from "../context/PanelContext";
import { SidePanel } from "./SidePanel";
import { SignInView } from "./SignInView";

const ActivityPage = lazy(() => import("../pages/ActivityPage").then((m) => ({ default: m.ActivityPage })));
const PlayersPage = lazy(() => import("../pages/PlayersPage").then((m) => ({ default: m.PlayersPage })));
const PlayerDetailPage = lazy(() => import("../pages/PlayerDetailPage").then((m) => ({ default: m.PlayerDetailPage })));
const GameDetailPage = lazy(() => import("../pages/GameDetailPage").then((m) => ({ default: m.GameDetailPage })));
const ProfilePage = lazy(() => import("../pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ReviewPage = lazy(() => import("../pages/ReviewPage").then((m) => ({ default: m.ReviewPage })));

const LABELS: Record<PanelEntry["type"], string> = {
  activity: "Activity",
  players: "Players",
  player: "Player",
  game: "Game",
  profile: "Account",
  review: "Review",
  signin: "Sign in",
};

function PanelPage({ entry, onClose, onBack }: { entry: PanelEntry; onClose: () => void; onBack: () => void }) {
  switch (entry.type) {
    case "activity":
      return <ActivityPage />;
    case "players":
      return <PlayersPage />;
    case "player":
      return <PlayerDetailPage playerId={entry.id} />;
    case "game":
      return <GameDetailPage gameId={entry.id} />;
    case "profile":
      return <ProfilePage />;
    case "review":
      return <ReviewPage />;
    case "signin":
      // A preview opened from Account goes back to it rather than closing the panel
      return <SignInView onDone={entry.preview ? onBack : onClose} preview={entry.preview} />;
  }
}

// Renders the top of the desktop panel stack over whatever page is showing
export function PanelHost() {
  const panel = usePanel();
  const top = panel?.stack[panel.stack.length - 1];
  const frame = useMemo(
    () => panel && { canGoBack: panel.stack.length > 1, back: panel.back, close: panel.close, open: panel.push },
    [panel]
  );
  if (!panel || !top || !frame) return null;

  return (
    // Account and sign in open from the top-left account button, so they slide in from the left
    <SidePanel
      label={LABELS[top.type]}
      side={["profile", "signin", "review"].includes(panel.stack[0].type) ? "left" : "right"}
      onClose={panel.close}
    >
      <PanelFrameProvider value={frame}>
        <Suspense fallback={<div className="loading">Loading...</div>}>
          {/* Keyed so each step starts fresh (scroll, local state) */}
          <PanelPage key={`${panel.stack.length}:${top.type}:${"id" in top ? top.id : ""}`} entry={top} onClose={panel.close} onBack={panel.back} />
        </Suspense>
      </PanelFrameProvider>
    </SidePanel>
  );
}
