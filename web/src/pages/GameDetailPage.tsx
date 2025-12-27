import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useActivity } from "../hooks/useActivity";
import { useDataCache } from "../context/DataCacheContext";
import { computeWinnerID } from "../models/Match";
import { useSession } from "../context/SessionContext";
import { useAuth } from "../context/AuthContext";
import { MatchRow } from "../components/MatchRow";
import { EditGameForm } from "../components/EditGameForm";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { Match } from "../models/Match";
import type { Game } from "../models/Game";
import "./GameDetailPage.css";

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

export function GameDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { games, editGame, removeGame } = useGames();
  const { matches: allMatches } = useActivity(500, 365 * 10);
  const { players } = useDataCache();
  const { createSession } = useSession();
  const { user, isAuthenticated } = useAuth();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

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

  const handleEditGame = async (gameId: string, updates: Partial<Game>) => {
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
      navigate("/games");
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

  const getInitials = (name: string): string =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  const getFirstName = (name: string): string =>
    name.trim().split(" ")[0] || name;

  // Compute top 3 players by wins for this game
  const winCounts = new Map<string, number>();
  for (const match of gameMatches) {
    const winnerOrTeamId = computeWinnerID(match, game);
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
  const sortedTop = Array.from(winCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([playerId, wins]) => ({
      player: players.find((p) => p.id === playerId),
      wins,
    }))
    .filter((x) => x.player);

  return (
    <div className="game-detail-page">
      <div className="page-header">
        <div className="page-header-nav">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="back-button"
            size="icon"
          >
            <ChevronLeft />
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(true)}
              className="edit-button"
            >
              Edit
            </Button>
          )}
        </div>
        {game.coverArt && (
          <div className="game-cover-art-section">
            <div className="game-cover-art-large">
              <img
                src={game.coverArt}
                alt={game.title}
                className="game-cover-art-image"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        )}
        <h1 className="game-title-full-width">{game.title}</h1>
      </div>

      {sortedTop.length > 0 && (
        <div className="game-stats">
          <div className="game-leaderboard">
            {sortedTop.length >= 2 && (
              <div className="leader second">
                <div className="avatar-wrap">
                  {sortedTop[1].player!.photoData ? (
                    <img
                      className="avatar"
                      src={`data:image/jpeg;base64,${
                        sortedTop[1].player!.photoData
                      }`}
                      alt={sortedTop[1].player!.name}
                    />
                  ) : (
                    <span className="avatar initials">
                      {getInitials(sortedTop[1].player!.name)}
                    </span>
                  )}
                  <span className="rank-badge">2</span>
                </div>
                <div className="meta">
                  <div className="name">
                    {getFirstName(sortedTop[1].player!.name)}
                  </div>
                  <div className="wins">
                    {sortedTop[1].wins}{" "}
                    {sortedTop[1].wins === 1 ? "win" : "wins"}
                  </div>
                </div>
              </div>
            )}
            {sortedTop.length >= 1 && (
              <div className="leader first">
                <div className="crown" aria-hidden>
                  👑
                </div>
                <div className="avatar-wrap">
                  {sortedTop[0].player!.photoData ? (
                    <img
                      className="avatar"
                      src={`data:image/jpeg;base64,${
                        sortedTop[0].player!.photoData
                      }`}
                      alt={sortedTop[0].player!.name}
                    />
                  ) : (
                    <span className="avatar initials">
                      {getInitials(sortedTop[0].player!.name)}
                    </span>
                  )}
                  <span className="rank-badge primary">1</span>
                </div>
                <div className="meta">
                  <div className="name">
                    {getFirstName(sortedTop[0].player!.name)}
                  </div>
                  <div className="wins">
                    {sortedTop[0].wins}{" "}
                    {sortedTop[0].wins === 1 ? "win" : "wins"}
                  </div>
                </div>
              </div>
            )}
            {sortedTop.length >= 3 && (
              <div className="leader third">
                <div className="avatar-wrap">
                  {sortedTop[2].player!.photoData ? (
                    <img
                      className="avatar"
                      src={`data:image/jpeg;base64,${
                        sortedTop[2].player!.photoData
                      }`}
                      alt={sortedTop[2].player!.name}
                    />
                  ) : (
                    <span className="avatar initials">
                      {getInitials(sortedTop[2].player!.name)}
                    </span>
                  )}
                  <span className="rank-badge">3</span>
                </div>
                <div className="meta">
                  <div className="name">
                    {getFirstName(sortedTop[2].player!.name)}
                  </div>
                  <div className="wins">
                    {sortedTop[2].wins}{" "}
                    {sortedTop[2].wins === 1 ? "win" : "wins"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleCreateSession}
        disabled={isCreatingSession}
        className="start-session-button start-session-button-mobile"
        size="lg"
      >
        {isCreatingSession ? "Creating..." : "Start Session"}
      </Button>

      <div className="matches-section">
        <h2>Matches</h2>
        {gameMatches.length === 0 ? (
          <div className="empty-state">
            <p>No matches yet</p>
            <p>Start a session to invite others to play.</p>
          </div>
        ) : (
          <div className="matches-list">
            {gameMatches.map((match) => (
              <MatchRow key={match.id} match={match} hideGameTitle={true} />
            ))}
          </div>
        )}
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
