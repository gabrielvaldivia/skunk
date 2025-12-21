import type { Game } from '../models/Game';
import './GameCard.css';

interface GameCardProps {
  game: Game;
  onClick?: () => void;
}

export function GameCard({ game, onClick }: GameCardProps) {
  return (
    <div className="game-card" onClick={onClick}>
      <h3 className="game-title">{game.title}</h3>
      <div className="game-info">
        <span className="game-badge">
          {game.isBinaryScore ? 'Win/Loss' : 'Score-based'}
        </span>
        <span className="game-players">
          {game.supportedPlayerCounts.join(', ')} players
        </span>
      </div>
    </div>
  );
}

