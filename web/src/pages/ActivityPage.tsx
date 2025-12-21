import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivity } from '../hooks/useActivity';
import { useMatches } from '../hooks/useMatches';
import { useGames } from '../hooks/useGames';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { MatchRow } from '../components/MatchRow';
import { AddMatchForm } from '../components/AddMatchForm';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Match } from '../models/Match';
import './ActivityPage.css';

export function ActivityPage() {
  const navigate = useNavigate();
  const { matches, isLoading, error } = useActivity();
  const { games } = useGames();
  const { addMatch } = useMatches();
  const { isAuthenticated } = useAuth();
  const { createSession } = useSession();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  // Updates automatically in real-time via Firebase listeners

  const handleSubmitMatch = async (match: Omit<Match, 'id'>) => {
    await addMatch(match);
  };

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    try {
      const session = await createSession();
      toast.success("Session created!");
      navigate(`/session/${session.code}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create session";
      toast.error(errorMessage);
    } finally {
      setIsCreatingSession(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading matches...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="activity-page">
      <div className="page-header">
        <h1>Matches</h1>
        <div className="header-actions">
          {isAuthenticated && (
            <Button
              variant="outline"
              onClick={handleCreateSession}
              disabled={isCreatingSession}
            >
              {isCreatingSession ? "Creating..." : "+ New Session"}
            </Button>
          )}
          {isAuthenticated && games.length > 0 && (
            <Button onClick={() => setShowAddForm(true)}>+ New Match</Button>
          )}
        </div>
      </div>

      <AddMatchForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        onSubmit={handleSubmitMatch}
      />

      {matches.length === 0 ? (
        <div className="empty-state">
          <p>No matches yet</p>
          {isAuthenticated && games.length > 0 ? (
            <p className="empty-hint">
              Click "New Match" to create your first match
            </p>
          ) : isAuthenticated && games.length === 0 ? (
            <p className="empty-hint">Create a game first to start recording matches</p>
          ) : (
            <p className="empty-hint">Sign in to create matches</p>
          )}
        </div>
      ) : (
        <div className="matches-list">
          {matches.map(match => (
            <MatchRow key={match.id} match={match} hideGameTitle={false} />
          ))}
        </div>
      )}
    </div>
  );
}

