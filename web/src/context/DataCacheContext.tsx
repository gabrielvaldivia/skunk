import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import { getGames, getPlayers, subscribeToPlayers } from '../services/databaseService';

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

  // Games load once; players stay live, since other people add them mid-session
  // (a player added on someone else's phone would otherwise show as a raw id)
  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  useEffect(
    () =>
      subscribeToPlayers(
        (list) => {
          setPlayers(list);
          setPlayersError(null);
          setPlayersLoading(false);
        },
        (error) => {
          setPlayersError(error);
          setPlayersLoading(false);
          console.error('Error watching players:', error);
        }
      ),
    []
  );

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

