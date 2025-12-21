import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGames } from '../hooks/useGames';
import { useActivity } from '../hooks/useActivity';
import { useMatches } from '../hooks/useMatches';
import { MatchRow } from '../components/MatchRow';
import { AddMatchForm } from '../components/AddMatchForm';
import { Button } from '@/components/ui/button';
import type { Match } from '../models/Match';
import './GameDetailPage.css';

export function GameDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { games } = useGames();
  const { matches: allMatches } = useActivity(500, 365 * 10);
  const { addMatch } = useMatches();
  const [showAddForm, setShowAddForm] = useState(false);

  const game = games.find(g => g.id === id);
  const gameMatches: Match[] = allMatches
    .filter(m => m.gameID === id)
    .map(match => ({
      ...match,
      game: game || undefined
    }));

  const handleSubmitMatch = async (match: Omit<Match, 'id'>) => {
    await addMatch(match);
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
          <Button onClick={() => setShowAddForm(true)}>+ New Match</Button>
        </div>
        <h1>{game.title}</h1>
      </div>

      <AddMatchForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        onSubmit={handleSubmitMatch}
        defaultGameId={game.id}
      />
      
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
    </div>
  );
}

