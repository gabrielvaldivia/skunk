import { useMemo } from 'react';
import { getMatchWinnerID } from '../models/Match';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import type { Match } from '../models/Match';
import { usePlayersData } from '../context/DataCacheContext';

export interface GameChampion {
  gameId: string;
  playerId: string | undefined;
  playerName: string | undefined;
  playerIds?: string[];
  playerNames?: string[];
  winCount: number;
}

export function useGameChampions(games: Game[], matches: Match[] = []) {
  const { players } = usePlayersData();

  const champions = useMemo(() => {
    if (games.length === 0) {
      return new Map<string, GameChampion>();
    }

    // Create a map of player ID to player name
    const playerMap = new Map<string, Player>();
    players.forEach(player => {
      playerMap.set(player.id, player);
    });

    // Group matches by game once, rather than scanning them all per game
    const matchesByGame = new Map<string, Match[]>();
    for (const match of matches) {
      const list = matchesByGame.get(match.gameID);
      if (list) list.push(match);
      else matchesByGame.set(match.gameID, [match]);
    }

    // Calculate champions for each game
    const championsMap = new Map<string, GameChampion>();

    games.forEach(game => {
      const gameMatches = matchesByGame.get(game.id) ?? [];

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
        const winnerId = getMatchWinnerID(match, game);
        if (!winnerId) return;
        // Team games name the winning team; each of its players gets the win,
        // as on the game's leaderboard
        const team = game.isTeamBased ? match.teams?.find((t) => t.teamId === winnerId) : undefined;
        for (const id of team ? team.playerIDs : [winnerId]) {
          winCounts.set(id, (winCounts.get(id) || 0) + 1);
        }
      });

      // Find max wins and handle ties
      let maxWins = 0;
      winCounts.forEach((wins) => {
        if (wins > maxWins) maxWins = wins;
      });
      const championIds: string[] = [];
      winCounts.forEach((wins, playerId) => {
        if (wins === maxWins) {
          championIds.push(playerId);
        }
      });
      const championPlayers = championIds
        .map(id => playerMap.get(id))
        .filter(Boolean) as Player[];
      championPlayers.sort((a, b) => a.name.localeCompare(b.name));
      const orderedChampionIds = championPlayers.map((player) => player.id);
      const championNames = championPlayers.map((player) => player.name);

      championsMap.set(game.id, {
        gameId: game.id,
        playerId: orderedChampionIds[0],
        playerName: championNames.length > 1 ? championNames.join(" & ") : championNames[0],
        playerIds: orderedChampionIds,
        playerNames: championNames,
        winCount: maxWins
      });
    });

    return championsMap;
  }, [games, matches, players]);

  return { champions };
}
