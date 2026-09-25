import { useCallback } from 'react';
import type { Game } from '../models/Game';
import type { FieldUpdates } from '../services/databaseService';
import { createGame, updateGame, deleteGame } from '../services/databaseService';
import { useDataCache } from '../context/DataCacheContext';

export function useGames() {
  const { games, gamesById, gamesLoading: isLoading, gamesError: error } = useDataCache();

  const addGame = useCallback(async (game: Omit<Game, 'id'>) => {
    try {
      const newGame = await createGame(game);
      return newGame;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create game');
    }
  }, []);

  const editGame = useCallback(async (gameId: string, updates: FieldUpdates<Game>) => {
    try {
      await updateGame(gameId, updates);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update game');
    }
  }, []);

  const removeGame = useCallback(async (gameId: string) => {
    try {
      await deleteGame(gameId);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete game');
    }
  }, []);

  return {
    games,
    gamesById,
    isLoading,
    error,
    addGame,
    editGame,
    removeGame
  };
}

