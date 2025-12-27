import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useGames } from "../hooks/useGames";
import { useActivity } from "../hooks/useActivity";
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
        <div className="game-header-content">
          <div className="game-header-actions-desktop"></div>
          <h1 className="game-title-full-width">{game.title}</h1>
        </div>
      </div>

      <Button
        onClick={handleCreateSession}
        disabled={isCreatingSession}
        className="start-session-button start-session-button-mobile"
        size="lg"
      >
        {isCreatingSession ? "Creating..." : "Start Session"}
      </Button>

      <div className="matches-section">
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
