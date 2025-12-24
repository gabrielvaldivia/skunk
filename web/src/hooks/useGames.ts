import { useCallback } from 'react';
import type { Game } from '../models/Game';
import { createGame, updateGame, deleteGame } from '../services/databaseService';
import { useDataCache } from '../context/DataCacheContext';

export function useGames() {
  const { games, gamesLoading: isLoading, gamesError: error, refreshGames } = useDataCache();

  const addGame = useCallback(async (game: Omit<Game, 'id'>) => {
    try {
      const newGame = await createGame(game);
      await refreshGames();
      return newGame;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create game');
    }
  }, [refreshGames]);

  const editGame = useCallback(async (gameId: string, updates: Partial<Game>) => {
    try {
      await updateGame(gameId, updates);
      await refreshGames();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update game');
    }
  }, [refreshGames]);

  const removeGame = useCallback(async (gameId: string) => {
    try {
      await deleteGame(gameId);
      await refreshGames();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete game');
    }
  }, [refreshGames]);

  return {
    games,
    isLoading,
    error,
    fetchGames: refreshGames,
    addGame,
    editGame,
    removeGame
  };
}

