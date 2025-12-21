import type { Match } from '../models/Match';
import './MatchRow.css';

interface MatchRowProps {
  match: Match;
  hideGameTitle?: boolean;
}

export function MatchRow({ match, hideGameTitle = false }: MatchRowProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="match-row">
      <div className="match-header">
        {!hideGameTitle && match.game && (
          <span className="match-game">{match.game.title}</span>
        )}
        <span className="match-date">{formatDate(match.date)}</span>
      </div>
      <div className="match-info">
        <span className="match-players">
          {match.playerIDs.length} player{match.playerIDs.length !== 1 ? 's' : ''}
        </span>
        {match.winnerID && (
          <span className="match-winner">Winner: {match.winnerID}</span>
        )}
      </div>
    </div>
  );
}

