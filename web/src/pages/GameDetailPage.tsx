import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useActivity } from "../hooks/useActivity";
import { useDataCache } from "../context/DataCacheContext";
import { computeWinnerID } from "../models/Match";
import { useSession } from "../context/SessionContext";
import { MiniSessionSheet } from "../components/MiniSessionSheet";
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
  const { createSession, currentSession } = useSession();
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
  const getPlacementLabel = (ps: { name: string }[]) =>
    ps
      .slice(0, 2)
      .map((p) => getFirstName(p.name))
      .join(" & ");

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
          <h2 className="page-title-top">{game.title}</h2>
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
        {/* Game cover art intentionally hidden per design */}
      </div>

      <div className="page-content">
        {placements.length > 0 && (
          <div className="game-stats">
            <div className="game-leaderboard">
              {placements.length >= 2 && (
                <div className="leader second">
                  {placements[1].players.length > 1 ? (
                    <div className="avatar-pile diagonal">
                      {placements[1].players.slice(0, 2).map((p, idx) =>
                        p.photoData ? (
                          <img
                            key={p.id}
                            className={`avatar ${
                              idx === 0 ? "pos-a" : "pos-b"
                            }`}
                            src={`data:image/jpeg;base64,${p.photoData}`}
                            alt={p.name}
                          />
                        ) : (
                          <span
                            key={p.id}
                            className={`avatar initials ${
                              idx === 0 ? "pos-a" : "pos-b"
                            }`}
                          >
                            {getInitials(p.name)}
                          </span>
                        )
                      )}
                      <span className="rank-badge">2</span>
                    </div>
                  ) : (
                    <div className="avatar-wrap">
                      {placements[1].players[0]?.photoData ? (
                        <img
                          className="avatar"
                          src={`data:image/jpeg;base64,${placements[1].players[0].photoData}`}
                          alt={placements[1].players[0].name}
                        />
                      ) : (
                        <span className="avatar initials">
                          {placements[1].players[0] &&
                            getInitials(placements[1].players[0].name)}
                        </span>
                      )}
                      <span className="rank-badge">2</span>
                    </div>
                  )}
                  <div className="meta">
                    <div className="name">
                      {getPlacementLabel(placements[1].players)}
                    </div>
                    <div className="wins">
                      {placements[1].wins}{" "}
                      {placements[1].wins === 1 ? "win" : "wins"}
                    </div>
                  </div>
                </div>
              )}
              {placements.length >= 1 && (
                <div className="leader first">
                  <div className="crown" aria-hidden>
                    👑
                  </div>
                  {placements[0].players.length > 1 ? (
                    <div className="avatar-pile diagonal">
                      {placements[0].players.slice(0, 2).map((p, idx) =>
                        p.photoData ? (
                          <img
                            key={p.id}
                            className={`avatar ${
                              idx === 0 ? "pos-a" : "pos-b"
                            }`}
                            src={`data:image/jpeg;base64,${p.photoData}`}
                            alt={p.name}
                          />
                        ) : (
                          <span
                            key={p.id}
                            className={`avatar initials ${
                              idx === 0 ? "pos-a" : "pos-b"
                            }`}
                          >
                            {getInitials(p.name)}
                          </span>
                        )
                      )}
                      <span className="rank-badge primary">1</span>
                    </div>
                  ) : (
                    <div className="avatar-wrap">
                      {placements[0].players[0]?.photoData ? (
                        <img
                          className="avatar"
                          src={`data:image/jpeg;base64,${placements[0].players[0].photoData}`}
                          alt={placements[0].players[0].name}
                        />
                      ) : (
                        <span className="avatar initials">
                          {placements[0].players[0] &&
                            getInitials(placements[0].players[0].name)}
                        </span>
                      )}
                      <span className="rank-badge primary">1</span>
                    </div>
                  )}
                  <div className="meta">
                    <div className="name">
                      {getPlacementLabel(placements[0].players)}
                    </div>
                    <div className="wins">
                      {placements[0].wins}{" "}
                      {placements[0].wins === 1 ? "win" : "wins"}
                    </div>
                  </div>
                </div>
              )}
              {placements.length >= 3 && (
                <div className="leader third">
                  {placements[2].players.length > 1 ? (
                    <div className="avatar-pile diagonal">
                      {placements[2].players.slice(0, 2).map((p, idx) =>
                        p.photoData ? (
                          <img
                            key={p.id}
                            className={`avatar ${
                              idx === 0 ? "pos-a" : "pos-b"
                            }`}
                            src={`data:image/jpeg;base64,${p.photoData}`}
                            alt={p.name}
                          />
                        ) : (
                          <span
                            key={p.id}
                            className={`avatar initials ${
                              idx === 0 ? "pos-a" : "pos-b"
                            }`}
                          >
                            {getInitials(p.name)}
                          </span>
                        )
                      )}
                      <span className="rank-badge">3</span>
                    </div>
                  ) : (
                    <div className="avatar-wrap">
                      {placements[2].players[0]?.photoData ? (
                        <img
                          className="avatar"
                          src={`data:image/jpeg;base64,${placements[2].players[0].photoData}`}
                          alt={placements[2].players[0].name}
                        />
                      ) : (
                        <span className="avatar initials">
                          {placements[2].players[0] &&
                            getInitials(placements[2].players[0].name)}
                        </span>
                      )}
                      <span className="rank-badge">3</span>
                    </div>
                  )}
                  <div className="meta">
                    <div className="name">
                      {getPlacementLabel(placements[2].players)}
                    </div>
                    <div className="wins">
                      {placements[2].wins}{" "}
                      {placements[2].wins === 1 ? "win" : "wins"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!currentSession && (
          <Button
            onClick={handleCreateSession}
            disabled={isCreatingSession}
            className="start-session-button start-session-button-mobile"
            size="lg"
          >
            {isCreatingSession ? "Creating..." : "Start Session"}
          </Button>
        )}
        {currentSession && <MiniSessionSheet />}

        <div className="matches-section">
          {gameMatches.length > 0 && <h2>Matches</h2>}
          {gameMatches.length === 0 ? (
            <div className="empty-state">
              <p>No matches yet</p>
              <p className="muted-text">
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
