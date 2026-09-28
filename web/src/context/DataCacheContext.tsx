import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import { getGames, subscribeToPlayers, updateGame } from '../services/databaseService';
import { useAuth } from './AuthContext';
import { isAdminEmail } from '../lib/admin';
import { COVER_ENHANCEMENT_VERSION } from '../lib/coverVersion';

interface GamesData {
  games: Game[];
  gamesLoading: boolean;
  gamesError: Error | null;
  refreshGames: () => Promise<void>;
}

interface PlayersData {
  players: Player[];
  playersLoading: boolean;
  playersError: Error | null;
}

// Separate contexts, so a player update (a heart, a follow, anyone's) doesn't
// re-render everything that only shows games, like the 3D shelf
const GamesContext = createContext<GamesData | undefined>(undefined);
const PlayersContext = createContext<PlayersData | undefined>(undefined);

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [gamesError, setGamesError] = useState<Error | null>(null);
  const [playersError, setPlayersError] = useState<Error | null>(null);
  const migratedCoversForUser = useRef<string | null>(null);

  // Only the first load shows as loading; later refreshes (after an add or
  // edit) keep the current games on screen until the new list arrives
  const refreshGames = useCallback(async () => {
    try {
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

  // Games load once; players stay live, since other people add them mid-session
  // (a player added on someone else's phone would otherwise show as a raw id)
  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  useEffect(() => {
    if (!user || gamesLoading || gamesError || migratedCoversForUser.current === user.uid) return;
    const isAdmin = isAdminEmail(user.email);
    const oldEmbeddedCovers = games.filter(
      (game) =>
        game.coverArt?.startsWith('data:image/') &&
        (game.coverArtEnhancementVersion ?? 0) < COVER_ENHANCEMENT_VERSION &&
        (game.createdByID === user.uid || isAdmin)
    );
    migratedCoversForUser.current = user.uid;
    if (!oldEmbeddedCovers.length) return;

    // Older records did not distinguish camera scans from uploaded cover photos.
    // Both are embedded images, and the conservative correction is safe for either.
    void (async () => {
      const { enhanceCoverDataUrl } = await import('../lib/coverScan');
      let changed = false;
      for (const game of oldEmbeddedCovers) {
        try {
          const coverArt = await enhanceCoverDataUrl(game.coverArt!);
          await updateGame(game.id, {
            coverArt,
            coverArtEnhancementVersion: COVER_ENHANCEMENT_VERSION,
          });
          changed = true;
        } catch (error) {
          console.warn(`Couldn't enhance the existing cover for ${game.title}:`, error);
        }
      }
      if (changed) await refreshGames();
    })();
  }, [games, gamesError, gamesLoading, refreshGames, user]);

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

  const gamesValue = useMemo(
    () => ({ games, gamesLoading, gamesError, refreshGames }),
    [games, gamesLoading, gamesError, refreshGames]
  );
  const playersValue = useMemo(
    () => ({ players, playersLoading, playersError }),
    [players, playersLoading, playersError]
  );

  return (
    <GamesContext.Provider value={gamesValue}>
      <PlayersContext.Provider value={playersValue}>{children}</PlayersContext.Provider>
    </GamesContext.Provider>
  );
}

export function useGamesData() {
  const context = useContext(GamesContext);
  if (context === undefined) {
    throw new Error('useGamesData must be used within a DataCacheProvider');
  }
  return context;
}

export function usePlayersData() {
  const context = useContext(PlayersContext);
  if (context === undefined) {
    throw new Error('usePlayersData must be used within a DataCacheProvider');
  }
  return context;
}

/** Games and players together, for components that show both */
export function useDataCache() {
  return { ...useGamesData(), ...usePlayersData() };
}
