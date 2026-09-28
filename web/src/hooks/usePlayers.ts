import { useCallback } from 'react';
import type { Player } from '../models/Player';
import { createPlayer, deletePlayer } from '../services/databaseService';
import { usePlayersData } from '../context/DataCacheContext';

// The players list is live, so adds and deletes show up without a refetch
export function usePlayers() {
  const { players, playersLoading: isLoading, playersError: error } = usePlayersData();

  const addPlayer = useCallback(async (player: Omit<Player, 'id'>) => {
    try {
      return await createPlayer(player);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create player');
    }
  }, []);

  const removePlayer = useCallback(async (playerId: string) => {
    try {
      await deletePlayer(playerId);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete player');
    }
  }, []);

  return {
    players,
    isLoading,
    error,
    addPlayer,
    removePlayer
  };
}
