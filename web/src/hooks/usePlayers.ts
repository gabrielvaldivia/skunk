import { useCallback } from 'react';
import type { Player } from '../models/Player';
import { createPlayer, deletePlayer } from '../services/databaseService';
import { usePlayersData } from '../context/DataCacheContext';

// The players list is a cached copy, so re-read it after adding or removing one
export function usePlayers() {
  const { players, playersLoading: isLoading, playersError: error, refreshPlayers } = usePlayersData();

  const addPlayer = useCallback(async (player: Omit<Player, 'id'>) => {
    try {
      const created = await createPlayer(player);
      await refreshPlayers();
      return created;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create player');
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
    addPlayer,
    removePlayer
  };
}
