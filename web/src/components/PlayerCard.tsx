import type { Player } from '../models/Player';
import type { ReactNode } from 'react';
import './PlayerCard.css';
import { getPlayerColor, getInitials } from "@/lib/player";

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  rightAction?: ReactNode;
  subtitle?: string;
}

export function PlayerCard({ player, onClick, rightAction, subtitle }: PlayerCardProps) {
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
        {subtitle && <p className="player-subtitle">{subtitle}</p>}
      </div>
      {rightAction && <div className="player-actions">{rightAction}</div>}
    </div>
  );
}

