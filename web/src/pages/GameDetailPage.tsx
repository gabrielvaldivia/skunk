import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGames } from '../hooks/useGames';
import { useActivity } from '../hooks/useActivity';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { MatchRow } from '../components/MatchRow';
import { EditGameForm } from '../components/EditGameForm';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Match } from '../models/Match';
import type { Game } from '../models/Game';
import './GameDetailPage.css';

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

export function GameDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { games, editGame, removeGame } = useGames();
  const { matches: allMatches } = useActivity(500, 365 * 10);
  const { createSession } = useSession();
  const { user } = useAuth();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const isAdmin = user?.email === ADMIN_EMAIL;

  const game = games.find(g => g.id === id);
  const gameMatches: Match[] = allMatches
    .filter(m => m.gameID === id)
    .map(match => ({
      ...match,
      game: game || undefined
      }));

  const handleCreateSession = async () => {
    if (!id) return;
    
    setIsCreatingSession(true);
    try {
      const session = await createSession(id);
      toast.success("Session created!");
      navigate(`/session/${session.code}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create session";
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
      const errorMessage = err instanceof Error ? err.message : "Failed to update game";
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
      const errorMessage = err instanceof Error ? err.message : "Failed to delete game";
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
        <div className="page-header-top">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back
          </Button>
        </div>
        <div className="page-header-title-row">
          <h1>{game.title}</h1>
          <div className="flex gap-2">
            {isAdmin && (
              <Button 
                variant="outline"
                onClick={() => setIsEditDialogOpen(true)}
              >
                Edit
              </Button>
            )}
            <Button 
              onClick={handleCreateSession} 
              disabled={isCreatingSession}
            >
              {isCreatingSession ? "Creating..." : "Add Session"}
            </Button>
          </div>
        </div>
      </div>

      <div className="game-info">
        <div className="info-item">
          <span className="info-label">Type:</span>
          <span>{game.isBinaryScore ? 'Win/Loss' : 'Score-based'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Players:</span>
          <span>{game.supportedPlayerCounts.join(', ')}</span>
        </div>
        {game.highestScoreWins !== undefined && (
          <div className="info-item">
            <span className="info-label">Winner:</span>
            <span>{game.highestScoreWins ? 'Highest score' : 'Lowest score'}</span>
          </div>
        )}
      </div>

      <div className="matches-section">
        <h2>Matches ({gameMatches.length})</h2>
        {gameMatches.length === 0 ? (
          <div className="empty-state">
            <p>No matches yet</p>
          </div>
        ) : (
          <div className="matches-list">
            {gameMatches.map(match => (
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

