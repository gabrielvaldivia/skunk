import { lazy, Suspense } from "react";
import type { Game } from "../models/Game";
import { AppLink } from "./AppLink";
import "./GameStatsCarousel.css";

const GameBoxPreview = lazy(() =>
  import("./shelf/GameBoxPreview").then((module) => ({ default: module.GameBoxPreview }))
);

export interface GameStatsCarouselItem {
  gameId: string;
  game?: Game;
  title: string;
  subtitle: string;
}

export function GameStatsCarousel({ items }: { items: GameStatsCarouselItem[] }) {
  return (
    <div className="game-stats-carousel">
      {items.map(({ game, gameId, title, subtitle }) => (
        <AppLink
          to={`/games/${gameId}`}
          className="game-stats-card"
          key={gameId}
          aria-label={`${title}, ${subtitle}`}
        >
          <span className="game-stats-box">
            {game ? (
              <Suspense fallback={<span className="game-stats-box-placeholder" />}>
                <GameBoxPreview game={game} size={132} />
              </Suspense>
            ) : (
              <span className="game-stats-box-placeholder">{title.charAt(0)}</span>
            )}
          </span>
          <span className="game-stats-title">{title}</span>
          <span className="game-stats-subtitle">{subtitle}</span>
        </AppLink>
      ))}
    </div>
  );
}
