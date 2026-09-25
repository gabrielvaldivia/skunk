import { lazy, Suspense, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useActivity } from "../hooks/useActivity";
import { useDataCache } from "../context/DataCacheContext";
import { getMatchWinnerID } from "../models/Match";
import { useSession } from "../context/SessionContext";
import { MiniSessionSheet } from "../components/MiniSessionSheet";
import { useAuth } from "../context/AuthContext";
import { MatchRow } from "../components/MatchRow";
import { EditGameForm } from "../components/EditGameForm";
import { Button } from "@/components/ui/button";
import { EditIcon, HeartIcon } from "../components/icons";
import { useGameHeart } from "../hooks/useGameScope";
import { NavBar } from "../components/NavBar";
import { Avatar } from "../components/Avatar";
import type { Player } from "../models/Player";
import { toast } from "sonner";
import type { Match } from "../models/Match";
import type { Game } from "../models/Game";
import type { FieldUpdates } from "../services/databaseService";
import "./GameDetailPage.css";
import { isAdminEmail } from "@/lib/admin";
import { useMediaQuery } from "@/hooks/use-media-query";

interface GameDetailPageProps {
  /** Show this game instead of the one in the URL, e.g. in the shelf's side panel */
  gameId?: string;
  /** When set, the page is embedded: the host provides the close button and the cover is hidden */
  onClose?: () => void;
  /** Replaces the nav bar's (empty) centre, e.g. with a game picker */
  navTitle?: React.ReactNode;
}

// three.js loads only when a game page is opened
const GameBoxPreview = lazy(() =>
  import("../components/shelf/GameBoxPreview").then((m) => ({ default: m.GameBoxPreview }))
);

export function GameDetailPage({ gameId, onClose, navTitle }: GameDetailPageProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const id = gameId ?? params.id;
  const { games, editGame, removeGame } = useGames();
  const { matches: allMatches } = useActivity(10000); // Full history for stats; shares the listener with list pages
  const { players } = useDataCache();
  const { createSession, currentSession } = useSession();
  const { user, isAuthenticated } = useAuth();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isAdmin = isAdminEmail(user?.email);
  const heart = useGameHeart(id, games);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const game = games.find((g) => g.id === id);
  const gameMatches: Match[] = allMatches
    .filter((m) => m.gameID === id)
    .map((match) => ({
      ...match,
      game: game || undefined,
    }));

  const handleCreateSession = async () => {
    if (!id) return;

    // Require sign-in before creating a session
    if (!isAuthenticated) {
      navigate("/signin", { state: { from: location }, replace: true });
      return;
    }

    setIsCreatingSession(true);
    try {
      const session = await createSession(id);
      const url = `${window.location.origin}/session/${session.code}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Session created! URL copied to clipboard.");
      } catch {
        toast.success("Session created!");
      }
      navigate(`/session/${session.code}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create session";
      toast.error(errorMessage);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleEditGame = async (gameId: string, updates: FieldUpdates<Game>) => {
    try {
      await editGame(gameId, updates);
      toast.success("Game updated!");
      setIsEditDialogOpen(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update game";
      toast.error(errorMessage);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await removeGame(gameId);
      toast.success("Game deleted!");
      setIsEditDialogOpen(false);
      if (onClose) onClose();
      else navigate("/games");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete game";
      toast.error(errorMessage);
      throw err; // Re-throw so EditGameForm can handle it
    }
  };

  if (!game) {
    return (
      <div className="game-detail-page">
        <div className="error">Game not found</div>
      </div>
    );
  }

  const getFirstName = (name: string): string =>
    name.trim().split(" ")[0] || name;
  const getPlacementLabel = (ps: { name: string }[]) =>
    ps
      .slice(0, 2)
      .map((p) => getFirstName(p.name))
      .join(" & ");

  // Compute top 3 players by wins for this game
  const winCounts = new Map<string, number>();
  for (const match of gameMatches) {
    const winnerOrTeamId = getMatchWinnerID(match, game);
    if (!winnerOrTeamId) continue;
    if (game.isTeamBased && match.teams && match.teams.length > 0) {
      const team = match.teams.find((t) => t.teamId === winnerOrTeamId);
      if (team) {
        team.playerIDs.forEach((pid) => {
          winCounts.set(pid, (winCounts.get(pid) || 0) + 1);
        });
      }
    } else {
      winCounts.set(winnerOrTeamId, (winCounts.get(winnerOrTeamId) || 0) + 1);
    }
  }
  const sortedEntries = Array.from(winCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const groups: Array<{ wins: number; playerIds: string[] }> = [];
  for (let i = 0; i < sortedEntries.length && groups.length < 3; ) {
    const wins = sortedEntries[i][1];
    const tied: string[] = [];
    while (i < sortedEntries.length && sortedEntries[i][1] === wins) {
      tied.push(sortedEntries[i][0]);
      i++;
    }
    groups.push({ wins, playerIds: tied });
  }
  const placements = groups.map((g) => ({
    wins: g.wins,
    players: g.playerIds
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p),
  }));

  const totalPlayers = new Set(gameMatches.flatMap((m) => m.playerIDs)).size;

  return (
    <div className="game-detail-page">
      <NavBar
        title={navTitle}
        hideBack={!!onClose}
        // Full-screen on phones, the edit button joins the close button in the corners
        actionInCorner={!!onClose && !isDesktop}
        action={
          (heart.canHeart || isAdmin) && (
            <>
              {heart.canHeart && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={heart.toggle}
                  aria-pressed={heart.hearted}
                  aria-label={heart.hearted ? "Remove from My Games" : "Add to My Games"}
                  className={heart.hearted ? "text-red-500 hover:text-red-500" : undefined}
                >
                  <HeartIcon filled={heart.hearted} className="!size-5" />
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setIsEditDialogOpen(true)}
                  aria-label="Edit game"
                >
                  <EditIcon />
                </Button>
              )}
            </>
          )
        }
      />

      <div className="page-content">
        <div className="game-hero">
          {/* Embedded next to the shelf's 3D box, which already shows it.
              Otherwise the box in 3D, with the flat cover while three.js loads */}
          {!onClose && (
            <Suspense fallback={
            <div className="game-hero-art">
              <span className="game-hero-placeholder">
                {game.title.charAt(0).toUpperCase()}
              </span>
              {game.coverArt && (
                <img
                  src={game.coverArt}
                  alt=""
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </div>
            }>
              <GameBoxPreview game={game} />
            </Suspense>
          )}
          <h1 className="game-hero-title">{game.title}</h1>
          <p className="game-hero-meta">
            {gameMatches.length} {gameMatches.length === 1 ? "match" : "matches"}
            {totalPlayers > 0 &&
              ` · ${totalPlayers} ${totalPlayers === 1 ? "player" : "players"}`}
          </p>
        </div>

        {placements.length > 0 && (
          <div className="game-leaderboard">
            {placements.map((placement, idx) => (
              <PodiumSpot
                key={idx}
                rank={idx + 1}
                wins={placement.wins}
                players={placement.players}
                label={getPlacementLabel(placement.players)}
              />
            ))}
          </div>
        )}

        {!currentSession && (
          <Button
            onClick={handleCreateSession}
            disabled={isCreatingSession}
            className="floating-cta"
            size="lg"
          >
            {isCreatingSession ? "Creating..." : "Start Session"}
          </Button>
        )}
        {currentSession && <MiniSessionSheet />}

        <div className="matches-section">
          {gameMatches.length > 0 && <h2 className="section-title">Matches</h2>}
          {gameMatches.length === 0 ? (
            <div className="empty-state">
              <p>No matches yet</p>
              <p className="empty-hint">
                Start a session to invite others to play.
              </p>
            </div>
          ) : (
            <div className="matches-list">
              {gameMatches.map((match) => (
                <MatchRow key={match.id} match={match} hideGameTitle={true} />
              ))}
            </div>
          )}
        </div>
      </div>

      {isAdmin && game && (
        <EditGameForm
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          game={game}
          onSubmit={handleEditGame}
          onDelete={handleDeleteGame}
        />
      )}
    </div>
  );
}

const PODIUM_COLUMN = { 1: 2, 2: 1, 3: 3 } as const;

function PodiumSpot({
  rank,
  wins,
  players,
  label,
}: {
  rank: 1 | 2 | 3 | number;
  wins: number;
  players: Player[];
  label: string;
}) {
  const size = rank === 1 ? 84 : 60;
  const pile = players.slice(0, 2);
  return (
    <div
      className={`leader ${rank === 1 ? "first" : ""}`}
      style={{ gridColumn: PODIUM_COLUMN[rank as 1 | 2 | 3], gridRow: 1 }}
    >
      <div className="leader-avatar" style={{ width: size, height: size }}>
        {pile.length > 1 ? (
          <>
            <Avatar player={pile[0]} size={size * 0.68} className="pile-a" />
            <Avatar player={pile[1]} size={size * 0.68} className="pile-b" />
          </>
        ) : (
          pile[0] && <Avatar player={pile[0]} size={size} />
        )}
        <span className={`rank-badge ${rank === 1 ? "gold" : ""}`}>{rank}</span>
      </div>
      <div className="leader-name">{label}</div>
      <div className="leader-wins">
        {wins} {wins === 1 ? "win" : "wins"}
      </div>
    </div>
  );
}
