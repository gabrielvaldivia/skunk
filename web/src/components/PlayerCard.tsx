import type { Player } from '../models/Player';
import type { ReactNode } from 'react';
import './PlayerCard.css';
import { Avatar } from "./Avatar";
import { getFirstName } from '../lib/player';

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  rightAction?: ReactNode;
  subtitle?: string;
  /** Show the player by first name only, e.g. "Brian" */
  shortName?: boolean;
}

export function PlayerCard({ player, onClick, rightAction, subtitle, shortName }: PlayerCardProps) {
  return (
    <div
      className={`player-card${onClick ? " player-card-clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "link" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Avatar player={player} size={44} />
      <div className="player-info">
        <div className="player-name">{shortName ? getFirstName(player.name) : player.name}</div>
        {subtitle ? (
          <p className="player-subtitle">{subtitle}</p>
        ) : (
          player.email && <p className="player-subtitle">{player.email}</p>
        )}
      </div>
      {rightAction && <div className="player-actions">{rightAction}</div>}
    </div>
  );
}
