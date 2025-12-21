import { Link } from 'react-router-dom';
import type { Match } from '../models/Match';
import type { Player } from '../models/Player';
import { usePlayers } from '../hooks/usePlayers';
import { useGames } from '../hooks/useGames';
import { useAuth } from '../context/AuthContext';
import { useMatches } from '../hooks/useMatches';
import { Button } from '@/components/ui/button';
import './MatchRow.css';

const ADMIN_EMAIL = "valdivia.gabriel@gmail.com";

interface MatchRowProps {
  match: Match;
  hideGameTitle?: boolean;
  onDelete?: () => void;
}

export function MatchRow({ match, hideGameTitle = false, onDelete }: MatchRowProps) {
  const { players } = usePlayers();
  const { games } = useGames();
  const { user, player: currentPlayer } = useAuth();
  const { removeMatch } = useMatches();

  const getGame = () => {
    if (match.game) return match.game;
    return games.find(g => g.id === match.gameID);
  };

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

  const getPlayer = (playerID: string) => {
    return players.find(p => p.id === playerID);
  };

  const getPlayerColor = (player: Player) => {
    if (player.colorData) {
      return player.colorData;
    }
    const hash = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canDelete = () => {
    if (!user) return false;
    
    // Admins can delete any match
    const isAdmin = user.email === ADMIN_EMAIL;
    if (isAdmin) return true;
    
    // Can delete if user created the match or if current player is part of the match
    if (!currentPlayer) return false;
    return match.createdByID === user.uid || match.playerIDs.includes(currentPlayer.id);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this match?')) {
      return;
    }
    try {
      await removeMatch(match.id);
      if (onDelete) {
        onDelete();
      }
    } catch (err) {
      console.error('Error deleting match:', err);
      alert('Failed to delete match');
    }
  };

  const renderWinnerAvatar = (winner: Player | undefined) => {
    if (!winner) return null;
    
    const backgroundColor = getPlayerColor(winner);
    
    return (
      <div 
        className="match-winner-avatar" 
        style={{ backgroundColor }}
      >
        {winner.photoData ? (
          <img src={`data:image/jpeg;base64,${winner.photoData}`} alt={winner.name} />
        ) : (
          <span className="match-winner-initials">{getInitials(winner.name)}</span>
        )}
      </div>
    );
  };

  const renderMatchText = () => {
    if (!match.winnerID || match.playerIDs.length === 0) {
      return <span>Match result unavailable</span>;
    }

    const winner = getPlayer(match.winnerID);
    const otherPlayerIDs = match.playerIDs.filter(id => id !== match.winnerID);
    
    if (otherPlayerIDs.length === 0) {
      return (
        <>
          {winner ? (
            <Link to={`/players/${match.winnerID}`} className="match-link">
              {winner.name}
            </Link>
          ) : (
            <span>{match.winnerID}</span>
          )}
          <span> won</span>
        </>
      );
    }

    const otherPlayers = otherPlayerIDs.map(id => getPlayer(id));
    
    return (
      <>
        {winner ? (
          <Link to={`/players/${match.winnerID}`} className="match-link">
            {winner.name}
          </Link>
        ) : (
          <span>{match.winnerID}</span>
        )}
        <span> beat </span>
        {otherPlayers.map((player, index) => (
          <span key={player?.id || otherPlayerIDs[index]}>
            {player ? (
              <Link to={`/players/${player.id}`} className="match-link">
                {player.name}
              </Link>
            ) : (
              <span>{otherPlayerIDs[index]}</span>
            )}
            {index < otherPlayers.length - 1 && (
              <>
                {index < otherPlayers.length - 2 && <span>, </span>}
                {index === otherPlayers.length - 2 && <span> and </span>}
              </>
            )}
          </span>
        ))}
        {!hideGameTitle && (() => {
          const game = getGame();
          return game ? (
            <>
              <span> at </span>
              <Link to={`/games/${match.gameID}`} className="match-link">
                {game.title}
              </Link>
            </>
          ) : null;
        })()}
      </>
    );
  };

  const winner = match.winnerID ? getPlayer(match.winnerID) : undefined;

  return (
    <div className="match-row">
      <div className="match-main-content">
        {renderWinnerAvatar(winner)}
        <div className="match-content">
          <div className="match-text">{renderMatchText()}</div>
          <div className="match-date">{formatDate(match.date)}</div>
        </div>
      </div>
      {canDelete() && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="match-delete-button"
        >
          Delete
        </Button>
      )}
    </div>
  );
}

