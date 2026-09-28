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
import { AppLink } from "../components/AppLink";
import { AudienceControl } from "../components/AudienceControl";
import { useFriendIds, type ActivityAudience } from "../hooks/useFriends";

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
  const { user, player, isAuthenticated } = useAuth();
  const friendIds = useFriendIds();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [audience, setAudience] = useState<ActivityAudience>("friends");

  const isAdmin = isAdminEmail(user?.email);
  const heart = useGameHeart(id, games);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const game = games.find((g) => g.id === id);
  const allGameMatches: Match[] = allMatches
    .filter((m) => m.gameID === id)
    .map((match) => ({
      ...match,
      game: game || undefined,
    }));
  const gameMatches =
    !player || audience === "global"
      ? allGameMatches
      : allGameMatches.filter((match) =>
          match.playerIDs.some((playerId) => friendIds.has(playerId))
        );

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
  // Rank everyone who has won; players tied on wins share one row and rank
  // (1, 2, 2, 4). Rows fill until 10 people are shown, then your row joins
  // at the bottom when you're further down.
  const ranked: LeaderboardEntry[] = [];
  let rankedPeople = 0;
  for (const [id, wins] of Array.from(winCounts.entries()).sort((a, b) => b[1] - a[1])) {
    const found = players.find((p) => p.id === id);
    if (!found) continue;
    const previous = ranked[ranked.length - 1];
    if (previous?.wins === wins) {
      previous.players.push(found);
    } else {
      ranked.push({ players: [found], rank: rankedPeople + 1, wins });
    }
    rankedPeople++;
  }
  const leaders: LeaderboardEntry[] = [];
  let shownPeople = 0;
  for (const entry of ranked) {
    if (shownPeople >= 10) break;
    leaders.push(entry);
    shownPeople += entry.players.length;
  }
  const myEntry = player
    ? ranked.find((entry) => entry.players.some((p) => p.id === player.id))
    : undefined;
  if (myEntry && !leaders.includes(myEntry)) leaders.push(myEntry);

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
          {player && (
            <div className="game-hero-audience">
              <AudienceControl value={audience} onChange={setAudience} />
            </div>
          )}
        </div>

        {leaders.length > 0 && <h2 className="section-title">Leaderboard</h2>}
        {leaders.length > 0 && (
          <ol className="game-leaderboard">
            {leaders.map((entry) => (
              <LeaderRow
                key={entry.rank}
                entry={entry}
                share={entry.wins / leaders[0].wins}
                youId={player?.id}
              />
            ))}
          </ol>
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
              <p>{audience === "friends" && player ? "No friend matches yet" : "No matches yet"}</p>
              <p className="empty-hint">
                {audience === "friends" && player
                  ? "Follow players or share a session to see their matches here."
                  : "Start a session to invite others to play."}
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

interface LeaderboardEntry {
  /** More than one when tied on wins */
  players: Player[];
  rank: number;
  wins: number;
}

const MEDALS = { 1: "gold", 2: "silver", 3: "bronze" } as const;
const PILE_MAX = 3;

// The pill grows with wins relative to the leader, so where the avatars sit
// shows how far behind that row is. Ties stack their avatars in a facepile.
function LeaderRow({
  entry,
  share,
  youId,
}: {
  entry: LeaderboardEntry;
  share: number;
  youId?: string;
}) {
  const { players, rank, wins } = entry;
  const medal = MEDALS[rank as 1 | 2 | 3] ?? "plain";
  const nameOf = (p: Player) =>
    p.id === youId ? "You" : players.length > 1 ? p.name.trim().split(" ")[0] || p.name : p.name;
  const pile = players.slice(0, PILE_MAX);
  const extra = players.length - pile.length;
  return (
    <li className="leader-row">
      <span className={`leader-rank ${medal}`} aria-label={`Rank ${rank}`}>
        <span>{rank}</span>
      </span>
      <div className="leader-track">
        <div className="leader-card" style={{ "--share": share, "--faces": pile.length + (extra > 0 ? 1 : 0) } as React.CSSProperties}>
          <span className="leader-text">
            <span className="leader-name">
              {players.map((p, index) => (
                <span key={p.id}>
                  {index > 0 && (index === players.length - 1 ? " & " : ", ")}
                  <AppLink to={`/players/${p.id}`}>{nameOf(p)}</AppLink>
                </span>
              ))}
            </span>
            <span className="leader-stats">
              {wins} {wins === 1 ? "win" : "wins"}
            </span>
          </span>
          <span className="leader-pile">
            {pile.map((p) => (
              <AppLink
                key={p.id}
                to={`/players/${p.id}`}
                className="leader-pile-face"
                aria-label={`View ${p.name}'s profile`}
              >
                <Avatar player={p} size={44} />
              </AppLink>
            ))}
            {extra > 0 && <span className="leader-pile-face leader-pile-more">+{extra}</span>}
          </span>
        </div>
      </div>
    </li>
  );
}
