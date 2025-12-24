import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import { getGames, getPlayers } from '../services/databaseService';

interface DataCacheContextType {
  games: Game[];
  players: Player[];
  gamesLoading: boolean;
  playersLoading: boolean;
  gamesError: Error | null;
  playersError: Error | null;
  refreshGames: () => Promise<void>;
  refreshPlayers: () => Promise<void>;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [gamesError, setGamesError] = useState<Error | null>(null);
  const [playersError, setPlayersError] = useState<Error | null>(null);

  const refreshGames = useCallback(async () => {
    try {
      setGamesLoading(true);
      setGamesError(null);
      const fetchedGames = await getGames();
      setGames(fetchedGames);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch games');
      setGamesError(error);
      console.error('Error fetching games:', error);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  const refreshPlayers = useCallback(async () => {
    try {
      setPlayersLoading(true);
      setPlayersError(null);
      const fetchedPlayers = await getPlayers();
      setPlayers(fetchedPlayers);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch players');
      setPlayersError(error);
      console.error('Error fetching players:', error);
    } finally {
      setPlayersLoading(false);
    }
  }, []);

  // Load data once on mount
  useEffect(() => {
    refreshGames();
    refreshPlayers();
  }, [refreshGames, refreshPlayers]);

  const value: DataCacheContextType = {
    games,
    players,
    gamesLoading,
    playersLoading,
    gamesError,
    playersError,
    refreshGames,
    refreshPlayers,
  };

  return <DataCacheContext.Provider value={value}>{children}</DataCacheContext.Provider>;
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
}

