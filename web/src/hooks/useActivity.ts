import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getMatches } from '../services/databaseService';
import type { Match } from '../models/Match';

// One shared copy of match history for the whole app, read over HTTP (the
// site's cached copy first, then straight from the database after your own
// match changes; see refreshActivity). A live game night uses its own
// listener on the session's matches instead.
type Store = { matches: Match[]; loaded: boolean; error: Error | null };
let store: Store = { matches: [], loaded: false, error: null };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Store) {
  store = next;
  listeners.forEach((listener) => listener());
}

function load(fresh: boolean) {
  loading = getMatches({ fresh })
    .then((matches) => publish({ matches: matches.sort((a, b) => b.date - a.date), loaded: true, error: null }))
    .catch((err) => publish({ ...store, loaded: true, error: err instanceof Error ? err : new Error('Failed to fetch matches') }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Re-read match history from the database, after adding, editing or deleting a match */
export function refreshActivity() {
  return load(true);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useActivity(limit: number = 500, daysBack: number = 365 * 10) {
  const current = useSyncExternalStore(subscribe, () => store);
  useEffect(() => {
    if (!store.loaded && !loading) load(false);
  }, []);
  const matches = useMemo(() => {
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    return current.matches.filter((m) => m.date >= cutoff).slice(0, limit);
  }, [current.matches, limit, daysBack]);
  return { matches, isLoading: !current.loaded, error: current.error };
}
