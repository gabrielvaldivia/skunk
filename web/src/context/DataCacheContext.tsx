import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { Game } from '../models/Game';
import type { Player } from '../models/Player';
import {
  getGames, getPlayers, updateGame, getMyPendingImages, subscribeToAllPendingImages, PENDING_IMAGES_CHANGED,
  type PendingImage,
} from '../services/databaseService';
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
  /** Re-read players straight from the database (after your own change) */
  refreshPlayers: () => Promise<void>;
  /** Make sure these players are loaded, e.g. someone who just joined your session */
  ensurePlayers: (ids: string[]) => void;
}

interface ReviewData {
  /** Your own uploads waiting for review (they show to you already) */
  myPending: PendingImage[];
  /** Everything waiting for review; only filled in for the admin */
  allPending: PendingImage[];
}

// Separate contexts, so a player update (a heart, a follow, anyone's) doesn't
// re-render everything that only shows games, like the 3D shelf
const GamesContext = createContext<GamesData | undefined>(undefined);
const PlayersContext = createContext<PlayersData | undefined>(undefined);
const ReviewContext = createContext<ReviewData>({ myPending: [], allPending: [] });

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [gamesError, setGamesError] = useState<Error | null>(null);
  const [playersError, setPlayersError] = useState<Error | null>(null);
  const migratedCoversForUser = useRef<string | null>(null);
  const [myPending, setMyPending] = useState<PendingImage[]>([]);
  const [allPending, setAllPending] = useState<PendingImage[]>([]);
  const isAdmin = isAdminEmail(user?.email);

  // Your own uploads waiting for review: read once, and again whenever you
  // submit or withdraw one (no live listener, so no open connection)
  useEffect(() => {
    if (!user) {
      setMyPending([]);
      return;
    }
    let alive = true;
    const load = () => getMyPendingImages(user.uid).then((images) => alive && setMyPending(images), () => {});
    load();
    window.addEventListener(PENDING_IMAGES_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(PENDING_IMAGES_CHANGED, load);
    };
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      setAllPending([]);
      return;
    }
    return subscribeToAllPendingImages(setAllPending);
  }, [isAdmin]);

  // Only the first load shows as loading; later refreshes (after an add or
  // edit) keep the current games on screen until the new list arrives
  // The first load uses the site's cached copy; refreshes (after your own
  // add or edit) read the database directly so you see the change
  const firstGamesLoad = useRef(true);
  const refreshGames = useCallback(async () => {
    try {
      setGamesError(null);
      const fresh = !firstGamesLoad.current;
      firstGamesLoad.current = false;
      const fetchedGames = await getGames({ fresh });
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
    // Only the admin can write covers now; everyone else's go through review
    const oldEmbeddedCovers = !isAdmin ? [] : games.filter(
      (game) =>
        game.coverArt?.startsWith('data:image/') &&
        (game.coverArtEnhancementVersion ?? 0) < COVER_ENHANCEMENT_VERSION
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
  }, [games, gamesError, gamesLoading, refreshGames, user, isAdmin]);

  const loadPlayers = useCallback(async (fresh: boolean) => {
    try {
      setPlayers(await getPlayers({ fresh }));
      setPlayersError(null);
    } catch (error) {
      setPlayersError(error instanceof Error ? error : new Error('Failed to load players'));
      console.error('Error loading players:', error);
    } finally {
      setPlayersLoading(false);
    }
  }, []);
  useEffect(() => {
    loadPlayers(false);
  }, [loadPlayers]);
  const refreshPlayers = useCallback(() => loadPlayers(true), [loadPlayers]);

  // Someone who just signed up and joined your session isn't in the cached
  // list yet; fetch fresh once per unknown id
  const requested = useRef(new Set<string>());
  const ensurePlayers = useCallback(
    (ids: string[]) => {
      const known = new Set(players.map((p) => p.id));
      const missing = ids.filter((id) => !known.has(id) && !requested.current.has(id));
      if (!missing.length || playersLoading) return;
      missing.forEach((id) => requested.current.add(id));
      loadPlayers(true);
    },
    [players, playersLoading, loadPlayers]
  );

  // Your own pending uploads show to you straight away
  const shownGames = useMemo(() => {
    const covers = new Map(myPending.filter((p) => p.kind === 'game').map((p) => [p.targetId, p.image]));
    return covers.size ? games.map((g) => (covers.has(g.id) ? { ...g, coverArt: covers.get(g.id) } : g)) : games;
  }, [games, myPending]);
  const shownPlayers = useMemo(() => {
    const photos = new Map(myPending.filter((p) => p.kind === 'player').map((p) => [p.targetId, p.image]));
    return photos.size ? players.map((p) => (photos.has(p.id) ? { ...p, photoData: photos.get(p.id) } : p)) : players;
  }, [players, myPending]);

  const gamesValue = useMemo(
    () => ({ games: shownGames, gamesLoading, gamesError, refreshGames }),
    [shownGames, gamesLoading, gamesError, refreshGames]
  );
  const playersValue = useMemo(
    () => ({ players: shownPlayers, playersLoading, playersError, refreshPlayers, ensurePlayers }),
    [shownPlayers, playersLoading, playersError, refreshPlayers, ensurePlayers]
  );
  const reviewValue = useMemo(() => ({ myPending, allPending }), [myPending, allPending]);

  return (
    <GamesContext.Provider value={gamesValue}>
      <PlayersContext.Provider value={playersValue}>
        <ReviewContext.Provider value={reviewValue}>{children}</ReviewContext.Provider>
      </PlayersContext.Provider>
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

export function useReviewQueue() {
  return useContext(ReviewContext);
}
