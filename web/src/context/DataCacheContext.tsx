import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import { subscribeToGames, subscribeToPlayers } from '../services/databaseService';

interface DataCacheContextType {
  games: Game[];
  players: Player[];
  gamesById: Map<string, Game>;
  playersById: Map<string, Player>;
  gamesLoading: boolean;
  playersLoading: boolean;
  gamesError: Error | null;
  playersError: Error | null;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

// Live listeners so games/players added or edited elsewhere show up without a reload
export function DataCacheProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [gamesError, setGamesError] = useState<Error | null>(null);
  const [playersError, setPlayersError] = useState<Error | null>(null);

  useEffect(() => {
    return subscribeToGames(
      (fetchedGames) => {
        setGames(fetchedGames);
        setGamesError(null);
        setGamesLoading(false);
      },
      (error) => {
        console.error('Error fetching games:', error);
        setGamesError(error);
        setGamesLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    return subscribeToPlayers(
      (fetchedPlayers) => {
        setPlayers(fetchedPlayers);
        setPlayersError(null);
        setPlayersLoading(false);
      },
      (error) => {
        console.error('Error fetching players:', error);
        setPlayersError(error);
        setPlayersLoading(false);
      }
    );
  }, []);

  // O(1) lookups for list rows instead of games.find/players.find per row
  const gamesById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const value: DataCacheContextType = {
    games,
    players,
    gamesById,
    playersById,
    gamesLoading,
    playersLoading,
    gamesError,
    playersError,
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
