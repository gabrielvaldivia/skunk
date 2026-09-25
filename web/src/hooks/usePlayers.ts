import { useCallback } from 'react';
import type { Player } from '../models/Player';
import type { FieldUpdates } from '../services/databaseService';
import { createPlayer, updatePlayer, deletePlayer } from '../services/databaseService';
import { useDataCache } from '../context/DataCacheContext';

export function usePlayers() {
  const { players, playersLoading: isLoading, playersError: error } = useDataCache();

  const addPlayer = useCallback(async (player: Omit<Player, 'id'>) => {
    try {
      const newPlayer = await createPlayer(player);
      return newPlayer;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create player');
    }
  }, []);

  const editPlayer = useCallback(async (playerId: string, updates: FieldUpdates<Player>) => {
    try {
      await updatePlayer(playerId, updates);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update player');
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
    editPlayer,
    removePlayer
  };
}

