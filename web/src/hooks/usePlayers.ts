import { useState, useEffect } from 'react';
import type { Player } from '../models/Player';
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from '../services/databaseService';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedPlayers = await getPlayers();
      setPlayers(fetchedPlayers);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch players'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const addPlayer = async (player: Omit<Player, 'id'>) => {
    try {
      const newPlayer = await createPlayer(player);
      setPlayers(prev => [...prev, newPlayer]);
      return newPlayer;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create player'));
      throw err;
    }
  };

  const editPlayer = async (playerId: string, updates: Partial<Player>) => {
    try {
      await updatePlayer(playerId, updates);
      setPlayers(prev => prev.map(player => player.id === playerId ? { ...player, ...updates } : player));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update player'));
      throw err;
    }
  };

  const removePlayer = async (playerId: string) => {
    try {
      await deletePlayer(playerId);
      setPlayers(prev => prev.filter(player => player.id !== playerId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete player'));
      throw err;
    }
  };

  return {
    players,
    isLoading,
    error,
    fetchPlayers,
    addPlayer,
    editPlayer,
    removePlayer
  };
}

