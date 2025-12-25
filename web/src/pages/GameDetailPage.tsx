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
        <div className="page-header-nav">
          <Button variant="ghost" onClick={() => navigate(-1)} className="back-button">
            ← Back
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
        <div className="game-header-content">
          <div className="game-cover-art-section">
            <div className="game-cover-art-large">
              {game.coverArt ? (
                <img 
                  src={game.coverArt} 
                  alt={game.title}
                  className="game-cover-art-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              {(!game.coverArt || game.coverArt === '') && (
                <div className="game-cover-art-placeholder-large">
                  {game.title.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="game-header-actions-desktop">
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
          <h1 className="game-title-full-width">{game.title}</h1>
          <Button 
            onClick={handleCreateSession} 
            disabled={isCreatingSession}
            className="start-session-button"
          >
            {isCreatingSession ? "Creating..." : "Start Session"}
          </Button>
        </div>
      </div>

      <div className="matches-section">
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

