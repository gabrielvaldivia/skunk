import type { Player } from '../models/Player';
import type { ReactNode } from 'react';
import './PlayerCard.css';

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  rightAction?: ReactNode;
  subtitle?: string;
}

export function PlayerCard({ player, onClick, rightAction, subtitle }: PlayerCardProps) {
  // Generate a color if colorData is not available (similar to Swift implementation)
  const getPlayerColor = (player: Player): string => {
    if (player.colorData) {
      return player.colorData;
    }
    // Generate a consistent color based on the name hash
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

  const backgroundColor = getPlayerColor(player);

  return (
    <div className="player-card" onClick={onClick}>
      <div 
        className="player-avatar" 
        style={{ backgroundColor }}
      >
        {player.photoData ? (
          <img src={`data:image/jpeg;base64,${player.photoData}`} alt={player.name} />
        ) : (
          <span className="player-initials">{getInitials(player.name)}</span>
        )}
      </div>
      <div className="player-info">
        <h3 className="player-name">{player.name}</h3>
        {subtitle ? (
          <p className="player-subtitle">{subtitle}</p>
        ) : (
          player.email && <p className="player-email">{player.email}</p>
        )}
      </div>
      {rightAction && <div className="player-actions">{rightAction}</div>}
    </div>
  );
}

