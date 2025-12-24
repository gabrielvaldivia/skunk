import { useCallback } from 'react';
import type { Player } from '../models/Player';
import { createPlayer, updatePlayer, deletePlayer } from '../services/databaseService';
import { useDataCache } from '../context/DataCacheContext';

export function usePlayers() {
  const { players, playersLoading: isLoading, playersError: error, refreshPlayers } = useDataCache();

  const addPlayer = useCallback(async (player: Omit<Player, 'id'>) => {
    try {
      const newPlayer = await createPlayer(player);
      await refreshPlayers();
      return newPlayer;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create player');
    }
  }, [refreshPlayers]);

  const editPlayer = useCallback(async (playerId: string, updates: Partial<Player>) => {
    try {
      await updatePlayer(playerId, updates);
      await refreshPlayers();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update player');
    }
  }, [refreshPlayers]);

  const removePlayer = useCallback(async (playerId: string) => {
    try {
      await deletePlayer(playerId);
      await refreshPlayers();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete player');
    }
  }, [refreshPlayers]);

  return {
    players,
    isLoading,
    error,
    fetchPlayers: refreshPlayers,
    addPlayer,
    editPlayer,
    removePlayer
  };
}

