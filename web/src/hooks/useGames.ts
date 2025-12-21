import { useState, useEffect } from 'react';
import type { Game } from '../models/Game';
import { getGames, createGame, updateGame, deleteGame } from '../services/databaseService';

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGames = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedGames = await getGames();
      setGames(fetchedGames);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch games'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const addGame = async (game: Omit<Game, 'id'>) => {
    try {
      const newGame = await createGame(game);
      setGames(prev => [...prev, newGame].sort((a, b) => a.title.localeCompare(b.title)));
      return newGame;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create game'));
      throw err;
    }
  };

  const editGame = async (gameId: string, updates: Partial<Game>) => {
    try {
      await updateGame(gameId, updates);
      setGames(prev => prev.map(game => game.id === gameId ? { ...game, ...updates } : game));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update game'));
      throw err;
    }
  };

  const removeGame = async (gameId: string) => {
    try {
      await deleteGame(gameId);
      setGames(prev => prev.filter(game => game.id !== gameId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete game'));
      throw err;
    }
  };

  return {
    games,
    isLoading,
    error,
    fetchGames,
    addGame,
    editGame,
    removeGame
  };
}

