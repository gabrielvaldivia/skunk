import { useMemo } from 'react';
import { computeWinnerID } from '../models/Match';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import type { Match } from '../models/Match';
import { useDataCache } from '../context/DataCacheContext';

export interface GameChampion {
  gameId: string;
  playerId: string | undefined;
  playerName: string | undefined;
  winCount: number;
}

export function useGameChampions(games: Game[], matches: Match[] = []) {
  const { players } = useDataCache();

  const champions = useMemo(() => {
    if (games.length === 0) {
      return new Map<string, GameChampion>();
    }

    // Create a map of player ID to player name
    const playerMap = new Map<string, Player>();
    players.forEach(player => {
      playerMap.set(player.id, player);
    });

    // Create a map of game ID to game
    const gameMap = new Map<string, Game>();
    games.forEach(game => {
      gameMap.set(game.id, game);
    });

    // Calculate champions for each game
    const championsMap = new Map<string, GameChampion>();

    games.forEach(game => {
      // Get all matches for this game
      const gameMatches = matches.filter(match => match.gameID === game.id);

      if (gameMatches.length === 0) {
        championsMap.set(game.id, {
          gameId: game.id,
          playerId: undefined,
          playerName: undefined,
          winCount: 0
        });
        return;
      }

      // Count wins per player
      const winCounts = new Map<string, number>();

      gameMatches.forEach(match => {
        const winnerId = computeWinnerID(match, game);
        if (winnerId) {
          winCounts.set(winnerId, (winCounts.get(winnerId) || 0) + 1);
        }
      });

      // Find player with most wins
      let championId: string | undefined;
      let maxWins = 0;

      winCounts.forEach((wins, playerId) => {
        if (wins > maxWins) {
          maxWins = wins;
          championId = playerId;
        }
      });

      const championPlayer = championId ? playerMap.get(championId) : undefined;

      championsMap.set(game.id, {
        gameId: game.id,
        playerId: championId,
        playerName: championPlayer?.name,
        winCount: maxWins
      });
    });

    return championsMap;
  }, [games, matches, players]);

  return { champions, isLoading: false };
}

