import { useCallback } from 'react';
import type { Game } from '../models/Game';
import type { FieldUpdates } from '../services/databaseService';
import { createGame, updateGame, deleteGame, submitImage } from '../services/databaseService';
import { useGamesData } from '../context/DataCacheContext';
import { useAuth } from '../context/AuthContext';
import { isAdminEmail } from '../lib/admin';

export function useGames() {
  const { games, gamesLoading: isLoading, gamesError: error, refreshGames } = useGamesData();
  const { user } = useAuth();

  // The admin's games go straight onto the shelf. Anyone else's are pending
  // until reviewed, and their cover waits in the review queue meanwhile
  const addGame = useCallback(async (game: Omit<Game, 'id'>) => {
    try {
      if (isAdminEmail(user?.email)) {
        const newGame = await createGame(game);
        await refreshGames();
        return newGame;
      }
      const { coverArt, coverArtEnhancementVersion, ...rest } = game;
      const newGame = await createGame({ ...rest, pending: true });
      if (coverArt && user) {
        await submitImage('game', newGame.id, coverArt, user.uid, coverArtEnhancementVersion ? { coverArtEnhancementVersion } : {});
      }
      await refreshGames();
      return newGame;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create game');
    }
  }, [refreshGames, user]);

  const editGame = useCallback(async (gameId: string, updates: FieldUpdates<Game>) => {
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
    addGame,
    editGame,
    removeGame
  };
}

