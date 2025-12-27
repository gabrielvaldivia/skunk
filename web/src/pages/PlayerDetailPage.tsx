import { useParams, useNavigate } from 'react-router-dom';
import { usePlayers } from '../hooks/usePlayers';
import { useActivity } from '../hooks/useActivity';
import { useGames } from '../hooks/useGames';
import { MatchRow } from '../components/MatchRow';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Match } from '../models/Match';
import './PlayerDetailPage.css';

export function PlayerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { players } = usePlayers();
  const { matches: allMatches } = useActivity(500, 365 * 10);
  const { games } = useGames();

  const player = players.find(p => p.id === id);
  const playerMatches: Match[] = allMatches
    .filter(m => m.playerIDs.includes(id || ''))
    .map(match => ({
      ...match,
      game: games.find(g => g.id === match.gameID) || undefined
    }));

  if (!player) {
    return (
      <div className="player-detail-page">
        <div className="error">Player not found</div>
      </div>
    );
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPlayerColor = (player: { colorData?: string; name: string }): string => {
    if (player.colorData) {
      return player.colorData;
    }
    const hash = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const wins = playerMatches.filter(m => m.winnerID === id).length;
  const bestStreak = (() => {
    const sorted = [...playerMatches].sort((a, b) => a.date - b.date);
    let current = 0;
    let best = 0;
    for (const match of sorted) {
      if (match.winnerID === (id || '')) {
        current += 1;
        if (current > best) {
          best = current;
        }
      } else {
        current = 0;
      }
    }
    return best;
  })();

  return (
    <div className="player-detail-page">
      <div className="page-header">
        <div className="page-header-top">
          <Button variant="outline" onClick={() => navigate(-1)} size="icon">
            <ChevronLeft />
          </Button>
        </div>
        <div className="player-header-content">
          <div 
            className="player-avatar-large" 
            style={{ backgroundColor: getPlayerColor(player) }}
          >
            {player.photoData ? (
              <img src={`data:image/jpeg;base64,${player.photoData}`} alt={player.name} />
            ) : (
              <span className="player-initials">{getInitials(player.name)}</span>
            )}
          </div>
          <div className="player-header-info">
            <h1>{player.name}</h1>
            {(player.location || player.bio) && (
              <div className="player-details">
                {player.location && (
                  <div className="player-location">
                    📍 {player.location}
                  </div>
                )}
                {player.bio && (
                  <div className="player-bio">
                    {player.bio}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="player-stats">
        <div className="stat-item">
          <span className="stat-value">{playerMatches.length}</span>
          <span className="stat-label">Matches</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{wins}</span>
          <span className="stat-label">Wins</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{bestStreak}</span>
          <span className="stat-label">Best Streak</span>
        </div>
      </div>

      <div className="matches-section">
        <h2>Match History</h2>
        {playerMatches.length === 0 ? (
          <div className="empty-state">
            <p>No matches yet</p>
          </div>
        ) : (
          <div className="matches-list">
            {playerMatches.map(match => (
              <MatchRow key={match.id} match={match} hideGameTitle={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

